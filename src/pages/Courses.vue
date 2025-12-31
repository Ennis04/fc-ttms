<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { 
    Search, Filter, Eye, ArrowLeft, Loader2, Users, GraduationCap, ChevronLeft, ChevronRight
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios"; 
import { useUserStore } from "@/stores/user"; 
import { readSessionJSON, writeSessionJSON, removeSession } from "@/stores/sessionStorage";

// --- STATE MANAGEMENT ---
const userStore = useUserStore(); 
const currentView = ref(1); // 1=List, 2=CourseDetail, 3=SectionDetail
const loading = ref(false);
const error = ref("");
const searchQuery = ref("");

// SESSION STATE
const currentSesi = ref("");
const currentSem = ref(1);

// PAGINATION STATE
const currentPage = ref(1);
const itemsPerPage = 10;

// Data Containers
const coursesList = ref([]);       
const selectedCourse = ref(null);  
const courseSections = ref([]);    
const selectedSection = ref(null); 
const sectionStudents = ref([]);   

// CACHE SETTINGS
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

const userKey = computed(() => localStorage.getItem("matric_no") || "unknown");
const cacheBase = computed(() => `ttms:directory:${userKey.value}`);

// cache keys
const keyLevel1 = computed(() => `${cacheBase.value}:level1`);
// level2 depends on sesi/sem + course code
const keyLevel2 = computed(() => {
  const code = selectedCourse.value?.kod_subjek || "none";
  return `${cacheBase.value}:level2:${currentSesi.value}:${currentSem.value}:${code}`;
});
// level3 depends on sesi/sem + course code + section
const keyLevel3 = computed(() => {
  const code = selectedCourse.value?.kod_subjek || "none";
  const sec = selectedSection.value?.seksyen || "none";
  return `${cacheBase.value}:level3:${currentSesi.value}:${currentSem.value}:${code}:${sec}`;
});

const isFresh = (savedAt) => {
  if (!CACHE_MAX_AGE_MS) return true;
  if (typeof savedAt !== "number") return false;
  return Date.now() - savedAt <= CACHE_MAX_AGE_MS;
};

// --- COMPUTED PROPERTIES ---

// 1. Search & Pagination
const filteredCourses = computed(() => {
    if (!searchQuery.value) return coursesList.value;
    const query = searchQuery.value.toLowerCase();
    return coursesList.value.filter(c => 
        c.nama_subjek.toLowerCase().includes(query) || 
        c.kod_subjek.toLowerCase().includes(query)
    );
});

const totalPages = computed(() => Math.ceil(filteredCourses.value.length / itemsPerPage));

const paginatedCourses = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredCourses.value.slice(start, end);
});

// 2. Statistics for Level 2
const courseStats = computed(() => {
    let stats = { students: 0, lecturers: 0, sections: 0 };
    if (!courseSections.value || courseSections.value.length === 0) return stats;
    
    const uniqueSections = new Set(courseSections.value.map(s => s.seksyen));
    stats.sections = uniqueSections.size;
    
    stats.students = courseSections.value.reduce((sum, sec) => {
        return sum + (parseInt(sec.bil_pelajar) || 0);
    }, 0);

    const uniqueLecturers = new Set(
        courseSections.value
        .map(s => s.pensyarah || s.nama || s.nama_pensyarah || s.nama_staf)
        .filter(name => name && name !== "")
    );
    stats.lecturers = uniqueLecturers.size;
    
    return stats;
});

// Reset pagination on search
watch(searchQuery, () => {
    currentPage.value = 1;
});

// --- API ACTIONS ---

// LEVEL 1: Fetch ALL Courses (Using Auto-Detected Session)
const restoreLevel1Cache = () => {
  const cached = readSessionJSON(keyLevel1.value, null);
  if (!cached || !isFresh(cached.savedAt)) return false;

  if (Array.isArray(cached.courses)) {
    coursesList.value = cached.courses;
  }
  if (cached.sesi) currentSesi.value = cached.sesi;
  if (cached.sem) currentSem.value = cached.sem;

  return coursesList.value.length > 0 && !!currentSesi.value;
};

const saveLevel1Cache = () => {
  writeSessionJSON(keyLevel1.value, {
    savedAt: Date.now(),
    sesi: currentSesi.value,
    sem: currentSem.value,
    courses: coursesList.value,
  });
};

const fetchCourses = async () => {
    loading.value = true;
    
    if (!userStore.sessionToken) {
        error.value = "Session lost. Please Logout and Login again.";
        loading.value = false;
        return;
    }

    try {
        // STEP A: Detect Session from History
        const historyRes = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: { entity: 'pelajar_subjek', no_matrik: localStorage.getItem('matric_no') }
        });
        
        const myHistory = historyRes.data;
        
        if (!myHistory || myHistory.length === 0) {
            // Fallback: Calculate current year dynamically
            const today = new Date();
            const year = today.getFullYear();
            currentSesi.value = `${year}/${year + 1}`;
            currentSem.value = 1;
        } else {
            currentSesi.value = myHistory[0].sesi;
            currentSem.value = myHistory[0].semester;
        }

        // STEP B: Fetch Directory
        const dirRes = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: {
                entity: 'subjek', 
                sesi: currentSesi.value,
                semester: currentSem.value
            }
        });
        
        coursesList.value = dirRes.data || [];
        // Sort Alphabetically
        coursesList.value.sort((a, b) => a.nama_subjek.localeCompare(b.nama_subjek));

        saveLevel1Cache();
    } catch (err) {
        error.value = "Failed to load directory. Ensure CORS is ON.";
    } finally {
        loading.value = false;
    }
};

// LEVEL 2: Fetch Details
const restoreLevel2Cache = () => {
  const cached = readSessionJSON(keyLevel2.value, null);
  if (!cached || !isFresh(cached.savedAt)) return false;

  if (cached.selectedCourse) selectedCourse.value = cached.selectedCourse;
  if (Array.isArray(cached.sections)) courseSections.value = cached.sections;

  return courseSections.value.length >= 0; // can be empty but still valid
};

const saveLevel2Cache = () => {
  writeSessionJSON(keyLevel2.value, {
    savedAt: Date.now(),
    selectedCourse: selectedCourse.value,
    sections: courseSections.value,
  });
};

const openCourseDetail = async (course) => {
  error.value = "";
  selectedCourse.value = {
    ...course,
    kredit: course.kredit || course.jam_kredit || "...",
    kod_fakulti: course.kod_fakulti || "FC",
  };

  if (restoreLevel2Cache()) {
    currentView.value = 2;
    return;
  }

  loading.value = true;
  try {
    const response = await axios.get("http://web.fc.utm.my/ttms/web_man_webservice_json.cgi", {
      params: {
        entity: "subjek_seksyen",
        sesi: currentSesi.value,
        semester: currentSem.value,
        limit: 1000,
      },
    });

    const allSubjectsData = response.data || [];
    const matchedSubject = allSubjectsData.find((s) => s.kod_subjek === course.kod_subjek);

    courseSections.value = matchedSubject?.seksyen_list ? matchedSubject.seksyen_list : [];
    courseSections.value.sort((a, b) => parseInt(a.seksyen) - parseInt(b.seksyen));

    saveLevel2Cache();
    currentView.value = 2;
  } catch (err) {
    error.value = "Failed to load course details.";
  } finally {
    loading.value = false;
  }
};


// LEVEL 3: Fetch Students
const restoreLevel3Cache = () => {
  const cached = readSessionJSON(keyLevel3.value, null);
  if (!cached || !isFresh(cached.savedAt)) return false;

  if (cached.selectedSection) selectedSection.value = cached.selectedSection;
  if (Array.isArray(cached.students)) sectionStudents.value = cached.students;

  return true;
};

const saveLevel3Cache = () => {
  writeSessionJSON(keyLevel3.value, {
    savedAt: Date.now(),
    selectedSection: selectedSection.value,
    students: sectionStudents.value,
  });
};

const openSectionDetail = async (section) => {
  error.value = "";
  selectedSection.value = section;

  if (!selectedCourse.value?.kod_subjek) {
    error.value = "Course not selected.";
    return;
  }

  // ✅ Cache first
  if (restoreLevel3Cache()) {
    currentView.value = 3;
    return;
  }

  loading.value = true;
  const sessionId = localStorage.getItem("session_id_utm_ttms");

  try {
    const response = await axios.get("http://web.fc.utm.my/ttms/web_man_webservice_json.cgi", {
      params: {
        entity: "subjek_pelajar",
        session_id: sessionId,
        sesi: currentSesi.value,
        semester: currentSem.value,
        kod_subjek: selectedCourse.value.kod_subjek,
        seksyen: section.seksyen,
      },
    });

    sectionStudents.value = Array.isArray(response.data) ? response.data : [];
    sectionStudents.value.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

    saveLevel3Cache();
    currentView.value = 3;
  } catch (err) {
    error.value = "Failed to load student list.";
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
    if (currentView.value === 3) currentView.value = 2;
    else if (currentView.value === 2) currentView.value = 1;
};

const nextPage = () => {
    if (currentPage.value < totalPages.value) currentPage.value++;
}
const prevPage = () => {
    if (currentPage.value > 1) currentPage.value--;
}

onMounted(() => {
  const restored = restoreLevel1Cache();
  if (!restored) fetchCourses();
});
</script>

<template>
    <div class="p-4 md:p-6 max-w-4xl mx-auto min-h-screen">
        
        <div v-if="loading" class="flex justify-center h-64 items-center">
            <Loader2 class="w-8 h-8 animate-spin text-primary"/>
        </div>
        <div v-else-if="error" class="bg-red-100 text-red-600 p-4 rounded mb-4">{{ error }}</div>

        <div v-else-if="currentView === 1">
            <div class="mb-6">
                 <h1 class="text-2xl font-bold text-primary">Course Directory</h1>
                 <p class="text-gray-500 text-sm">
                    Session {{ currentSesi || '...' }} | Semester {{ currentSem || '...' }}
                 </p>
            </div>

            <div class="relative w-full mb-6">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input v-model="searchQuery" placeholder="Search Course Name or Code" class="pl-10 bg-white rounded-full shadow-sm" />
            </div>

            <div class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
                <span>Subject Name</span>
                <span class="pr-8">Code</span>
            </div>

            <div class="space-y-1 min-h-[400px]">
                <div v-for="(course, i) in paginatedCourses" :key="i" 
                     class="flex items-center justify-between py-4 border-b border-gray-100 hover:bg-gray-50 px-2 transition-colors">
                    <div class="w-2/3 pr-4">
                        <p class="text-sm font-bold text-gray-800 uppercase">{{ course.nama_subjek }}</p>
                    </div>
                    <div class="w-1/3 flex items-center justify-between">
                        <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{{ course.kod_subjek }}</span>
                        <button @click="openCourseDetail(course)" class="text-gray-400 hover:text-primary">
                            <Eye class="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div v-if="filteredCourses.length === 0" class="text-center py-10 text-gray-400">
                    No courses found.
                </div>
            </div>

            <div v-if="filteredCourses.length > itemsPerPage" class="flex justify-between items-center mt-6 border-t pt-4">
                <Button variant="outline" size="sm" @click="prevPage" :disabled="currentPage === 1" class="flex gap-1 items-center">
                    <ChevronLeft class="w-4 h-4"/> Prev
                </Button>
                <span class="text-xs text-gray-500 font-medium">
                    Page {{ currentPage }} of {{ totalPages }}
                </span>
                <Button variant="outline" size="sm" @click="nextPage" :disabled="currentPage === totalPages" class="flex gap-1 items-center">
                    Next <ChevronRight class="w-4 h-4"/>
                </Button>
            </div>
        </div>

        <div v-else-if="currentView === 2">
            <button @click="goBack" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" /> Back to Directory
            </button>

            <Card class="w-full shadow-md border border-gray-100 mb-6 bg-white">
                <CardContent class="p-6">
                    <h2 class="text-xl font-bold text-primary mb-1 uppercase">{{ selectedCourse.nama_subjek }}</h2>
                    <p class="text-sm text-gray-500 mb-6">{{ selectedCourse.kod_subjek }}</p>

                    <div class="grid grid-cols-3 gap-4">
                        <div class="p-3 bg-purple-50 rounded-lg text-center">
                            <p class="text-xs text-gray-500 mb-1">Faculty</p>
                            <p class="font-bold text-gray-800">{{ selectedCourse.kod_fakulti }}</p>
                        </div>
                        <div class="p-3 bg-purple-50 rounded-lg text-center">
                            <p class="text-xs text-gray-500 mb-1">Sections</p>
                            <p class="font-bold text-gray-800">{{ courseStats.sections }}</p>
                        </div>
                        <div class="p-3 bg-purple-50 rounded-lg text-center">
                            <p class="text-xs text-gray-500 mb-1">Total Students</p>
                            <p class="font-bold text-gray-800">{{ courseStats.students }}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
                <span>Lecturer</span>
                <span class="pr-8">Section</span>
            </div>

            <div class="space-y-1">
                <div v-for="(sec, i) in courseSections" :key="i" 
                     class="flex items-center justify-between py-4 border-b border-gray-100 hover:bg-gray-50 px-2 transition-colors">
                    
                    <div class="w-2/3 pr-4 flex items-center gap-3">
                        <div class="bg-gray-100 p-2 rounded-full hidden md:block">
                            <Users class="w-4 h-4 text-gray-500"/>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800 uppercase">
                                {{ sec.pensyarah || sec.nama || sec.nama_pensyarah || sec.nama_staf || 'To Be Assigned' }}
                            </p>
                            <p class="text-xs text-gray-500">{{ sec.bil_pelajar || 0 }} Students</p>
                        </div>
                    </div>

                    <div class="w-1/3 flex items-center justify-end gap-4">
                        <p class="text-sm font-mono font-bold text-primary bg-gray-50 px-2 py-1 rounded">{{ sec.seksyen }}</p>
                        <button @click="openSectionDetail(sec)" class="text-gray-400 hover:text-primary">
                            <Eye class="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div v-if="courseSections.length === 0" class="p-4 text-center text-gray-400">
                    No sections found.
                </div>
            </div>
        </div>

        <div v-else-if="currentView === 3">
            <button @click="goBack" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" /> Back to Sections
            </button>

            <Card class="w-full shadow-md border border-gray-100 mb-6">
                <CardContent class="p-6 flex items-center justify-between">
                    <div>
                        <h2 class="text-lg font-bold text-gray-800 uppercase">{{ selectedCourse.nama_subjek }}</h2>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="bg-primary text-white text-xs px-2 py-0.5 rounded font-bold">SEC {{ selectedSection.seksyen }}</span>
                            <span class="text-sm text-gray-500">{{ selectedCourse.kod_subjek }}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold text-primary">{{ selectedSection.bil_pelajar || 0 }}</p>
                        <p class="text-xs text-gray-500 uppercase">Students</p>
                    </div>
                </CardContent>
            </Card>

            <div class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
                <span>Name</span>
                <span>Year/Program</span>
            </div>

            <div class="space-y-1">
                <div v-for="(stu, i) in sectionStudents" :key="i" 
                     class="flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50">
                    <div class="flex items-center gap-3">
                        <div class="bg-purple-50 p-2 rounded-full">
                            <GraduationCap class="w-4 h-4 text-primary" />
                        </div>
                        <p class="text-sm font-medium text-gray-800 uppercase">{{ stu.nama }}</p>
                    </div>
                    <div class="text-right">
                        <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {{ stu.tahun_kursus }} {{ stu.kod_kursus }}
                        </span>
                    </div>
                </div>

                <div v-if="sectionStudents.length === 0" class="text-center py-8 text-gray-400">
                    No student data available.<br>
                    <span class="text-xs">(Privacy restricted)</span>
                </div>
            </div>
        </div>

    </div>
</template>