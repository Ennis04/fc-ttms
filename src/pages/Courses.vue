<script setup>
import { ref, onMounted, computed } from "vue";
import { 
    Search, Eye, ArrowLeft, Loader2, GraduationCap, ChevronLeft, ChevronRight, BarChart3, List
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, Doughnut } from "vue-chartjs";
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from "chart.js";
import axios from "axios"; 
import { useUserStore } from "@/stores/user"; 

// REGISTER CHARTS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- STATE MANAGEMENT ---
const userStore = useUserStore(); 
const currentView = ref(0); 
const loading = ref(false);
const error = ref("");
const searchQuery = ref("");

// SESSION STATE
const currentSesi = ref("2025/2026"); 
const currentSem = ref(1);

// PAGINATION STATE
const currentPage = ref(1);
const itemsPerPage = 10;

// Data Containers
const rawAllSections = ref([]); 
const rawStudents = ref([]);    
const coursesList = ref([]);       
const selectedCourse = ref(null);  
const courseSections = ref([]);    
const selectedSection = ref(null); 
const sectionStudents = ref([]);   

// --- CHART OPTIONS ---
const topCoursesOptions = {
    indexAxis: 'y', 
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: {
                title: (tooltipItems) => tooltipItems[0].label,
                label: (context) => `Enrollment: ${context.formattedValue} Students`
            }
        }
    },
    scales: {
        x: { ticks: { precision: 0 }, grid: { display: false } },
        y: {
            ticks: {
                autoSkip: false,
                callback: function(value) {
                    const label = this.getLabelForValue(value);
                    return label.length > 25 ? label.substr(0, 25) + '...' : label;
                }
            }
        }
    }
};

// --- CHART DATA COMPUTED ---

// 1. Top 10 Popular Courses
const chartTopCourses = computed(() => {
    if (!rawAllSections.value.length) return null;

    const map = {};
    rawAllSections.value.forEach(sec => {
        const code = sec.kod_subjek;
        const count = parseInt(sec.bil_pelajar) || 0;
        if (!map[code]) map[code] = { name: sec.nama_subjek, total: 0 };
        map[code].total += count;
    });

    const sorted = Object.entries(map)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 10);

    return {
        labels: sorted.map(([code, data]) => `${code} - ${data.name}`), 
        datasets: [{
            label: 'Total Enrollments',
            data: sorted.map(([, data]) => data.total),
            backgroundColor: '#8b5cf6', 
            borderRadius: 6,
            barThickness: 20,
        }]
    };
});

// 2. Enrollment by Year Level
const chartLevelDist = computed(() => {
    if (!rawStudents.value.length) return null;

    const levels = { 'Year 1': 0, 'Year 2': 0, 'Year 3': 0, 'Year 4': 0 };

    rawStudents.value.forEach(stu => {
        const year = parseInt(stu.tahun_kursus) || 0;
        if (year === 1) levels['Year 1']++;
        else if (year === 2) levels['Year 2']++;
        else if (year === 3) levels['Year 3']++;
        else if (year >= 4) levels['Year 4']++;
    });

    return {
        labels: Object.keys(levels),
        datasets: [{
            label: 'Active Students',
            data: Object.values(levels),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            borderRadius: 6,
            barPercentage: 0.6
        }]
    };
});

// 3. Course Distribution by Area
const chartCourseDist = computed(() => {
    if (!rawAllSections.value.length) return null;

    const distribution = {};
    rawAllSections.value.forEach(sec => {
        let prefix = sec.kod_subjek.substring(0, 4).toUpperCase();
        if (!prefix.startsWith('SEC') && !prefix.startsWith('SCS') && !prefix.startsWith('UCS')) {
             prefix = 'Other'; 
        }
        const count = parseInt(sec.bil_pelajar) || 0;
        distribution[prefix] = (distribution[prefix] || 0) + count;
    });

    const sorted = Object.entries(distribution).sort(([,a], [,b]) => b - a);

    return {
        labels: sorted.map(([k]) => k),
        datasets: [{
            data: sorted.map(([,v]) => v),
            backgroundColor: [
                '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6'
            ],
            borderWidth: 0
        }]
    };
});

// --- HELPER ---
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

// --- API ACTIONS ---
const fetchAnalysisData = async () => {
    loading.value = true;
    const baseUrl = 'http://web.fc.utm.my/ttms/web_man_webservice_json.cgi';
    const sessionId = localStorage.getItem("session_id_utm_ttms");

    try {
        // 1. ADMIN AUTH: Get/Verify Admin ID
        let adminId = localStorage.getItem('admin_id_utm_ttms');
        
        if (!adminId && sessionId) {
            console.log("Admin ID missing, authenticating...");
            try {
                const authRes = await axios.get('http://web.fc.utm.my/ttms/auth-admin.php', {
                    params: { session_id: sessionId }
                });
                adminId = authRes.data?.[0]?.session_id;
                if (adminId) localStorage.setItem('admin_id_utm_ttms', adminId);
            } catch (authErr) { console.error("Admin auth failed:", authErr); }
        }

        // 2. FETCH ALL STUDENTS (PAGINATION LOOP)
        // Since API caps limit at 1000, we must loop offsets
        let allStudents = [];
        let offset = 0;
        let limit = 1000;
        let moreData = true;

        // Start Fetching Sections immediately (Parallel start)
        const sectionsPromise = axios.get(baseUrl, {
            params: {
                entity: 'subjek_seksyen', 
                sesi: currentSesi.value,
                semester: currentSem.value,
                limit: 3000
            }
        });

        // Loop to fetch students
        while (moreData) {
            const res = await axios.get(baseUrl, {
                params: {
                    entity: 'pelajar',
                    session_id: adminId || sessionId,
                    sesi: currentSesi.value,
                    semester: currentSem.value,
                    limit: limit,
                    offset: offset
                }
            });
            
            const data = res.data || [];
            allStudents = [...allStudents, ...data];

            if (data.length < limit) {
                moreData = false; // No more pages
            } else {
                offset += limit; // Next page
            }
        }

        // Wait for sections to finish
        const resSections = await sectionsPromise;
        const allSectionsData = resSections.data || [];

        // 3. FILTER DATA (Faculty of Computing Only)

        // Filter Sections
        rawAllSections.value = allSectionsData.filter(item => {
            const code = item.kod_subjek || "";
            const faculty = item.kod_fakulti || "";
            return (
                faculty === 'FC' || 
                code.startsWith('SEC') || code.startsWith('SCS') || code.startsWith('SC') || code.startsWith('UCS')
            );
        });

        // Filter Students
        rawStudents.value = allStudents.filter(stu => {
            const faculty = stu.kod_fakulti || "";
            const program = stu.kod_kursus || ""; 
            return (
                faculty === 'FC' || 
                program.startsWith('SEC') || program.startsWith('SCS') || program.startsWith('SC')
            );
        });

        // 4. PROCESS DIRECTORY LIST
        const uniqueSubjects = new Map();
        rawAllSections.value.forEach(item => {
            if (!uniqueSubjects.has(item.kod_subjek)) {
                uniqueSubjects.set(item.kod_subjek, {
                    kod_subjek: item.kod_subjek,
                    nama_subjek: item.nama_subjek,
                    kod_fakulti: item.kod_fakulti
                });
            }
        });
        
        coursesList.value = Array.from(uniqueSubjects.values())
            .sort((a, b) => a.nama_subjek.localeCompare(b.nama_subjek));

    } catch (err) {
        error.value = "Failed to load analysis data.";
        console.error(err);
    } finally {
        loading.value = false;
    }
};

const openCourseDetail = (course) => {
    selectedCourse.value = course;
    courseSections.value = rawAllSections.value.filter(s => s.kod_subjek === course.kod_subjek);
    currentView.value = 2;
};

const openSectionDetail = async (section) => {
    selectedSection.value = section;
    loading.value = true;
    try {
        const sessionId = localStorage.getItem("session_id_utm_ttms");
        const res = await axios.get("http://web.fc.utm.my/ttms/web_man_webservice_json.cgi", {
            params: {
                entity: "subjek_pelajar",
                session_id: sessionId,
                sesi: currentSesi.value,
                semester: currentSem.value,
                kod_subjek: selectedCourse.value.kod_subjek,
                seksyen: section.seksyen,
            },
        });
        sectionStudents.value = res.data || [];
        currentView.value = 3;
    } catch (err) { error.value = "Error loading students"; }
    finally { loading.value = false; }
};

onMounted(() => {
    fetchAnalysisData();
});
</script>

<template>
    <div class="p-4 md:p-6 max-w-[95%] mx-auto min-h-screen">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 class="text-3xl font-bold text-primary">FC Course Analysis</h1>
                <p class="text-gray-500">Session {{ currentSesi }} / Sem {{ currentSem }}</p>
                <p v-if="rawStudents.length > 0" class="text-xs font-bold text-green-600 mt-1">
                    Total FC Students: {{ rawStudents.length }}
                </p>
            </div>
            
            <div class="flex bg-gray-100 p-1 rounded-lg">
                <button @click="currentView = 0" 
                    :class="['px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2', 
                    currentView === 0 ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700']">
                    <BarChart3 class="w-4 h-4" /> Analysis
                </button>
                <button @click="currentView = 1" 
                    :class="['px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2', 
                    currentView === 1 ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700']">
                    <List class="w-4 h-4" /> Directory
                </button>
            </div>
        </div>

        <div v-if="loading" class="flex justify-center h-96 items-center">
            <Loader2 class="w-10 h-10 animate-spin text-primary"/>
        </div>

        <div v-else-if="currentView === 0" class="space-y-6">
            
            <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                
                <Card class="flex flex-col">
                    <CardHeader>
                        <CardTitle>Top 10 Courses</CardTitle>
                        <p class="text-xs text-gray-400">By total student enrollment</p>
                    </CardHeader>
                    <CardContent class="flex-1">
                        <div class="h-[500px] w-full">
                            <Bar v-if="chartTopCourses" :data="chartTopCourses" :options="topCoursesOptions" />
                        </div>
                    </CardContent>
                </Card>

                <Card class="flex flex-col">
                    <CardHeader>
                        <CardTitle>FC Students by Year</CardTitle>
                        <p class="text-xs text-gray-400">Distinct student headcount</p>
                    </CardHeader>
                    <CardContent class="flex-1">
                        <div class="h-[500px] w-full">
                            <Bar v-if="chartLevelDist" :data="chartLevelDist" :options="{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
                            }" />
                        </div>
                    </CardContent>
                </Card>
                
                <Card class="flex flex-col">
                    <CardHeader>
                        <CardTitle>Course Code Distribution</CardTitle>
                        <p class="text-xs text-gray-400">Based on course code prefix</p>
                    </CardHeader>
                    <CardContent class="flex-1 flex justify-center items-center">
                        <div class="h-[400px] w-[400px] relative">
                            <Doughnut v-if="chartCourseDist" :data="chartCourseDist" :options="{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '60%',
                                plugins: { 
                                    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 20 } } 
                                }
                            }" />
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>

        <div v-else-if="currentView === 1">
            <div class="relative w-full mb-6">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input v-model="searchQuery" placeholder="Search Course Name or Code" class="pl-10 bg-white" />
            </div>

            <div class="bg-white rounded-lg shadow-sm border border-gray-100">
                <div class="flex items-center justify-between bg-gray-50 p-3 text-xs uppercase font-bold text-gray-500 border-b">
                    <span>Subject</span>
                    <span class="pr-4">Action</span>
                </div>
                <div v-for="(course, i) in paginatedCourses" :key="i" 
                     class="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <div>
                        <p class="font-bold text-gray-800">{{ course.nama_subjek }}</p>
                        <span class="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{{ course.kod_subjek }}</span>
                    </div>
                    <Button variant="ghost" size="icon" @click="openCourseDetail(course)">
                        <Eye class="w-5 h-5 text-gray-400 hover:text-primary" />
                    </Button>
                </div>
                <div v-if="paginatedCourses.length === 0" class="p-8 text-center text-gray-400">
                    No courses found.
                </div>
            </div>

            <div class="flex justify-between items-center mt-6">
                <Button variant="outline" size="sm" @click="currentPage--" :disabled="currentPage === 1">
                    <ChevronLeft class="w-4 h-4 mr-1"/> Prev
                </Button>
                <span class="text-xs text-gray-500">Page {{ currentPage }} / {{ totalPages }}</span>
                <Button variant="outline" size="sm" @click="currentPage++" :disabled="currentPage === totalPages">
                    Next <ChevronRight class="w-4 h-4 ml-1"/>
                </Button>
            </div>
        </div>

        <div v-else-if="currentView === 2">
            <button @click="currentView = 0" class="flex items-center gap-2 text-primary mb-4 hover:underline">
                <ArrowLeft class="w-4 h-4" /> Back to Analysis
            </button>
            <Card>
                <CardHeader>
                    <CardTitle>{{ selectedCourse.nama_subjek }}</CardTitle>
                    <p class="text-sm text-gray-500">{{ selectedCourse.kod_subjek }}</p>
                </CardHeader>
                <CardContent>
                    <div class="space-y-2">
                        <div v-for="(sec, i) in courseSections" :key="i" class="flex justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                                <span class="font-bold text-primary">Section {{ sec.seksyen }}</span>
                                <p class="text-xs text-gray-600">{{ sec.pensyarah || 'No Lecturer' }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-sm font-bold">{{ sec.bil_pelajar }} Students</span>
                                <Button size="icon" variant="ghost" @click="openSectionDetail(sec)">
                                    <Eye class="w-4 h-4"/>
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div v-else-if="currentView === 3">
            <button @click="currentView = 2" class="flex items-center gap-2 text-primary mb-4 hover:underline">
                <ArrowLeft class="w-4 h-4" /> Back to Course
            </button>
            <Card>
                <CardHeader>
                    <CardTitle>Students in Section {{ selectedSection.seksyen }}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div v-for="(stu, i) in sectionStudents" :key="i" class="p-3 border rounded-lg flex items-center gap-3">
                            <div class="bg-primary/10 p-2 rounded-full"><GraduationCap class="w-4 h-4 text-primary"/></div>
                            <div>
                                <p class="font-bold text-sm">{{ stu.nama }}</p>
                                <p class="text-xs text-gray-500">{{ stu.no_matrik }} ({{ stu.kod_kursus }})</p>
                            </div>
                        </div>
                    </div>
                    <div v-if="!sectionStudents.length" class="text-center text-gray-400 py-10">No students found.</div>
                </CardContent>
            </Card>
        </div>

    </div>
</template>