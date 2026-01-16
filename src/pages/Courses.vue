<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { 
    Search, Eye, ArrowLeft, Loader2, Users, GraduationCap, ChevronLeft, ChevronRight, BarChart3, List
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, Doughnut } from "vue-chartjs"; // Import Chart Components
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from "chart.js";
import axios from "axios"; 
import { useUserStore } from "@/stores/user"; 
import { readSessionJSON, writeSessionJSON } from "@/stores/sessionStorage";

// REGISTER CHARTS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

// --- STATE MANAGEMENT ---
const userStore = useUserStore(); 
const currentView = ref(0); // 0=Dashboard, 1=List, 2=CourseDetail, 3=SectionDetail
const loading = ref(false);
const error = ref("");
const searchQuery = ref("");

// SESSION STATE
const currentSesi = ref("2025/2026"); // Default fallback
const currentSem = ref(1);

// PAGINATION STATE
const currentPage = ref(1);
const itemsPerPage = 10;

// Data Containers
const rawAllSections = ref([]); // Holds raw data for charts
const coursesList = ref([]);       
const selectedCourse = ref(null);  
const courseSections = ref([]);    
const selectedSection = ref(null); 
const sectionStudents = ref([]);   

// --- CHART DATA COMPUTED ---

// 1. Top 10 Popular Courses
const chartTopCourses = computed(() => {
    if (!rawAllSections.value.length) return null;

    // Group by Subject Code
    const map = {};
    rawAllSections.value.forEach(sec => {
        const code = sec.kod_subjek;
        const count = parseInt(sec.bil_pelajar) || 0;
        if (!map[code]) map[code] = { name: sec.nama_subjek, total: 0 };
        map[code].total += count;
    });

    // Sort and take top 10
    const sorted = Object.entries(map)
        .sort(([, a], [, b]) => b.total - a.total)
        .slice(0, 10);

    return {
        labels: sorted.map(([code]) => code),
        datasets: [{
            label: 'Total Students',
            data: sorted.map(([, data]) => data.total),
            backgroundColor: '#8b5cf6', // Purple
            borderRadius: 6
        }]
    };
});

// 2. Enrollment by Year Level (Based on 1st digit of code number, e.g., SECJ3xxx)
const chartLevelDist = computed(() => {
    if (!rawAllSections.value.length) return null;

    const levels = { 'Year 1': 0, 'Year 2': 0, 'Year 3': 0, 'Year 4': 0, 'Masters/Other': 0 };

    rawAllSections.value.forEach(sec => {
        // Regex to find the first digit after letters: SECJ(3)032
        const match = sec.kod_subjek.match(/[A-Z]+(\d)/); 
        const level = match ? parseInt(match[1]) : 0;
        const count = parseInt(sec.bil_pelajar) || 0;

        if (level === 1) levels['Year 1'] += count;
        else if (level === 2) levels['Year 2'] += count;
        else if (level === 3) levels['Year 3'] += count;
        else if (level === 4) levels['Year 4'] += count;
        else levels['Masters/Other'] += count;
    });

    return {
        labels: Object.keys(levels),
        datasets: [{
            label: 'Students Enrolled',
            data: Object.values(levels),
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
        }]
    };
});

// 3. Course Area Distribution (Based on Code Prefix, e.g., SECJ, SECR)
const chartCourseArea = computed(() => {
    if (!rawAllSections.value.length) return null;

    const areas = {};
    rawAllSections.value.forEach(sec => {
        // Regex: Get the alphabetic prefix (e.g., "SECJ" from "SECJ1013")
        const match = sec.kod_subjek.match(/^[A-Z]+/);
        const prefix = match ? match[0] : 'Other';
        
        const count = parseInt(sec.bil_pelajar) || 0;
        
        // Sum students per area
        areas[prefix] = (areas[prefix] || 0) + count;
    });

    // Optional: Sort by count descending so biggest slices come first
    const sortedEntries = Object.entries(areas).sort(([, a], [, b]) => b - a);

    return {
        labels: sortedEntries.map(([label]) => label),
        datasets: [{
            label: 'Students',
            data: sortedEntries.map(([, value]) => value),
            // A larger palette for potentially many departments
            backgroundColor: [
                '#3b82f6', '#8b5cf6', '#ec4899', '#10b981', 
                '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#f97316'
            ],
            borderWidth: 1
        }]
    };
});

// --- HELPER: SEARCH & PAGINATION ---
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
    try {
        // 1. Get Session Info (Optional if hardcoded)
        // ... (Reuse your session logic here if needed)

        // 2. Fetch ALL Sections (Heavy Query for Analysis)
        // We use 'subjek_seksyen' with a high limit to get everything for charts
        const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: {
                entity: 'subjek_seksyen', 
                sesi: currentSesi.value,
                semester: currentSem.value,
                limit: 3000 // Fetch all for accurate charts
            }
        });

        rawAllSections.value = res.data || [];

        // 3. Process Directory List (Unique Subjects for List View)
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

// --- NAVIGATION ---
const openCourseDetail = (course) => {
    selectedCourse.value = course;
    // Filter sections from our raw data instead of re-fetching
    courseSections.value = rawAllSections.value.filter(s => s.kod_subjek === course.kod_subjek);
    currentView.value = 2;
};

const openSectionDetail = async (section) => {
    selectedSection.value = section;
    loading.value = true;
    // We still need to fetch students individually as they aren't in the bulk call
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

const goBack = () => {
    if (currentView.value === 3) currentView.value = 2;
    else if (currentView.value === 2) currentView.value = 0; // Go back to dashboard
};

onMounted(() => {
    fetchAnalysisData();
});
</script>

<template>
    <div class="p-4 md:p-6 max-w-6xl mx-auto min-h-screen">
        
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h1 class="text-3xl font-bold text-primary">Academic Courses Analysis</h1>
                <p class="text-gray-500">Session {{ currentSesi }} / Sem {{ currentSem }}</p>
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Top 10 Most Popular Courses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="h-[300px]">
                            <Bar v-if="chartTopCourses" :data="chartTopCourses" :options="{
                                indexAxis: 'y',
                                responsive: true,
                                maintainAspectRatio: false
                            }" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Enrollment by Year</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="h-[300px]">
                            <Bar v-if="chartLevelDist" :data="chartLevelDist" :options="{
                                responsive: true,
                                maintainAspectRatio: false
                            }" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card class="bg-primary text-white">
                    <CardContent class="p-6 flex flex-col justify-center items-center h-full">
                        <span class="text-4xl font-bold">{{ coursesList.length }}</span>
                        <span class="uppercase text-xs tracking-wider opacity-80 mt-2">Total Subjects</span>
                    </CardContent>
                </Card>
                
                <Card class="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Student Distribution by Course</CardTitle> 
                    </CardHeader>
                    <CardContent class="flex justify-center">
                        <div class="h-[250px] w-[250px]">
                            <Doughnut v-if="chartCourseArea" :data="chartCourseArea" :options="{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { 
                                    legend: { 
                                        position: 'right',
                                        labels: { boxWidth: 12, font: { size: 11 } } 
                                    } 
                                }
                            }" />
                        <div v-else class="h-full flex items-center justify-center text-gray-400">
                            No Data
                        </div>
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