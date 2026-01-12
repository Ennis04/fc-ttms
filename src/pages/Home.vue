<script setup>
import { Button } from "@/components/ui/button"; 
import { useUserStore } from "@/stores/user";
import { Loader2 } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Bar } from "vue-chartjs";
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
} from "chart.js";
import axios from "axios";
import { readSessionJSON, writeSessionJSON } from "@/stores/sessionStorage";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const students = ref([])
const studentSession = ref('')
const studentYear = ref(0)
const studentSem = ref('')

const user = useUserStore()
const router = useRouter()
const isLoading = ref(true)
const chartOptions = ref({ responsive: true });

// --- CACHE SETTINGS ---
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const userKey = computed(() => user.matric_no || "unknown");
const cacheKeyStudent = computed(() => `ttms:home:student:${userKey.value}`);
const cacheKeyLecturer = computed(() => `ttms:home:lecturer:${userKey.value}`);

const isFresh = (savedAt) => {
    if (!savedAt) return false;
    return Date.now() - savedAt <= CACHE_MAX_AGE_MS;
};

const lecturerSubjects = ref([]);
const totalLecturerStudents = ref(0);

onMounted(async () => {
    if (user.role === 'student') {
        await fetchStudentData();
    } else {
        await fetchLecturerData();
    }
});

const fetchStudentData = async () => {
    try {
        isLoading.value = true;
        
        // Restore from cache if available
        const cached = readSessionJSON(cacheKeyStudent.value, null);
        if (cached && isFresh(cached.savedAt)) {
            students.value = cached.students;
            studentSession.value = cached.session;
            studentYear.value = cached.year;
            studentSem.value = cached.semester;
            isLoading.value = false;
            return;
        }

        const response = await axios.get(import.meta.env.VITE_BASE_URL, {
            params: {
                'entity': 'pelajar_subjek',
                'no_matrik': localStorage.getItem('matric_no')
            }
        });

        students.value = response.data;
        if (students.value.length > 0) {
            studentSession.value = students.value[0].sesi;
            studentYear.value = students.value[0].tahun_kursus;
            studentSem.value = students.value[0].semester;
        }

        // Save to cache
        writeSessionJSON(cacheKeyStudent.value, {
            savedAt: Date.now(),
            students: students.value,
            session: studentSession.value,
            year: studentYear.value,
            semester: studentSem.value
        });
    } catch (error) {
        console.error("Error fetching students list: ", error);
        toast.error("Failed to load student dashboard.");
    } finally {
        isLoading.value = false;
    }
};

const fetchLecturerData = async () => {
    try {
        isLoading.value = true;
        const matricNo = localStorage.getItem('matric_no');

        // Restore from cache if available
        const cached = readSessionJSON(cacheKeyLecturer.value, null);
        if (cached && isFresh(cached.savedAt)) {
            lecturerSubjects.value = cached.subjects;
            studentSession.value = cached.session;
            studentSem.value = cached.semester;
            totalLecturerStudents.value = cached.totalStudents;
            isLoading.value = false;
            return;
        }
        
        // 1. Get Lecturer Subjects
        const subRes = await axios.get(import.meta.env.VITE_BASE_URL, {
            params: { entity: 'pensyarah_subjek', no_pekerja: matricNo }
        });
        const staffSubjects = subRes.data || [];
        
        if (staffSubjects.length > 0) {
            studentSession.value = staffSubjects[0].sesi;
            studentSem.value = staffSubjects[0].semester;
            
            // 2. Get Student Distribution for these subjects to get enrollment counts
            const distRes = await axios.get(import.meta.env.VITE_BASE_URL, {
                params: { 
                    entity: 'subjek_seksyen', 
                    sesi: studentSession.value, 
                    semester: studentSem.value 
                }
            });
            const allDist = distRes.data || [];
            
            totalLecturerStudents.value = 0; 
            lecturerSubjects.value = staffSubjects.map(sub => {
                const match = allDist.find(d => d.kod_subjek === sub.kod_subjek);
                const sectionDetail = match?.seksyen_list?.find(s => s.seksyen == sub.seksyen);
                const count = sectionDetail ? parseInt(sectionDetail.bil_pelajar) : 0;
                totalLecturerStudents.value += count;
                return { ...sub, bil_pelajar: count };
            });

            // Save to cache
            writeSessionJSON(cacheKeyLecturer.value, {
                savedAt: Date.now(),
                subjects: lecturerSubjects.value,
                session: studentSession.value,
                semester: studentSem.value,
                totalStudents: totalLecturerStudents.value
            });
        }
    } catch (error) {
        console.error("Error fetching lecturer data: ", error);
        toast.error("Failed to load lecturer dashboard.");
    } finally {
        isLoading.value = false;
    }
};

const groupedSemesters = computed(() => {
    if (!students.value || !Array.isArray(students.value) || students.value.length === 0) {
        return [];
    }

    const yearSemesterMap = new Map();

    students.value.forEach(subject => {
        const year = subject.tahun_kursus;
        const semester = subject.semester;
        const key = `Year ${year} - Semester ${semester}`;

        if (!yearSemesterMap.has(key)) {
            yearSemesterMap.set(key, {
                sem_id: key.replace(/[^a-zA-Z0-9]/g, '_'),
                name: key,
                total_credit: 0,
                subjects: []
            });
        }

        const semGroup = yearSemesterMap.get(key);
        const structuredSubject = {
            code: subject.kod_subjek,
            name: subject.nama_subjek,
            credit: 3, 
            type: subject.kod_subjek.startsWith('SECJ') ? 'Core' : 'Elective'
        };

        semGroup.subjects.push(structuredSubject);
        semGroup.total_credit += structuredSubject.credit;
    });

    const groupedArray = Array.from(yearSemesterMap.values());
    groupedArray.sort((a, b) => {
        const yearA = parseInt(a.name.match(/Year (\d+)/)[1]);
        const yearB = parseInt(b.name.match(/Year (\d+)/)[1]);
        const semA = parseInt(a.name.match(/Semester (\d+)/)[1]);
        const semB = parseInt(b.name.match(/Semester (\d+)/)[1]);

        if (yearA !== yearB) return yearA - yearB;
        return semA - semB;
    });

    return groupedArray;
});

const chartData = computed(() => {
    if (user.role === 'student') {
        if (!students.value || students.value.length === 0) return null;
        
        const subjectCountByYear = students.value.reduce((acc, subject) => {
            const year = `Year ${subject.tahun_kursus}`;
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(subjectCountByYear).sort();
        const data = labels.map(label => subjectCountByYear[label]);

        return {
            labels: labels,
            datasets: [{
                label: 'Number of Subjects Taken',
                backgroundColor: '#0096FF', 
                borderColor: '#059669',
                borderWidth: 1,
                data: data,
            }]
        };
    } else {
        if (lecturerSubjects.value.length === 0) return null;
        
        const labels = lecturerSubjects.value.map(s => `${s.kod_subjek} (S${s.seksyen})`);
        const data = lecturerSubjects.value.map(s => s.bil_pelajar);

        return {
            labels: labels,
            datasets: [{
                label: 'Number of Students',
                backgroundColor: '#800000', 
                borderColor: '#600000',
                borderWidth: 1,
                data: data,
            }]
        };
    }
});

const totalAssignedCourses = computed(() => {
    const uniqueCourses = new Set(lecturerSubjects.value.map(s => s.kod_subjek));
    return uniqueCourses.size;
});
</script>

<template>
    <div v-if="isLoading" class="flex items-center justify-center h-screen">
        <Loader2 class="animate-spin text-primary h-8 w-8" />
    </div>

    <div class="p-6 space-y-6" v-if="!isLoading">
        <h1 class="text-2xl font-bold text-primary">Welcome back {{ user.name }}</h1>

        <div class="bg-white p-4 rounded shadow border-l-4 border-primary">
            <h2 class="text-lg font-semibold">{{ user.role === 'student' ? 'Admission Info' : 'Lecturer Info' }}</h2>
            
            <div class="flex flex-wrap gap-4 md:gap-6 mt-2 text-gray-700">
                <div v-if="studentSession"><span class="font-bold">Session:</span> {{ studentSession }}</div>
                <div v-if="user.role === 'student' && studentYear"><span class="font-bold">Current Year:</span> {{ studentYear }}</div>
                <div v-if="studentSem"><span class="font-bold">Semester:</span> {{ studentSem }}</div>
                
                <template v-if="user.role !== 'student'">
                    <div><span class="font-bold">Lecturer Name:</span> {{ user.name }}</div>
                    <div><span class="font-bold">Total Courses:</span> {{ totalAssignedCourses }}</div>
                    <div><span class="font-bold">Total Sections:</span> {{ lecturerSubjects.length }}</div>
                    <div><span class="font-bold">Total Students:</span> {{ totalLecturerStudents }}</div>
                </template>
            </div>
        </div>

        <div class="p-4 bg-white rounded-lg shadow-md w-full flex items-center justify-center">
            <div v-if="!chartData" class="text-center text-gray-500 w-full">
                <div class="flex items-center justify-center">
                    <Loader2 class="animate-spin text-primary h-8 w-8" />
                </div>
                <p class="mt-2 text-xs">Loading visualization...</p>
            </div>

            <div v-else class="w-full h-80 flex items-center justify-center">
                <Bar id="subject-load-chart" :options="chartOptions" :data="chartData" />
            </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
            <!-- Student View -->
            <template v-if="user.role === 'student'">
                <div v-for="sem in groupedSemesters" :key="sem.sem_id" class="bg-white border rounded-lg shadow-sm p-4">
                    <div class="flex justify-between border-b pb-2 mb-2">
                        <h3 class="font-bold text-primary">{{ sem.name }}</h3>
                        <span class="text-xs font-semibold bg-gray-200 px-2 py-1 rounded">Subjects: {{ sem.subjects.length }}</span>
                    </div>
                    <ul class="space-y-3">
                        <li v-for="sub in sem.subjects" :key="sub.code" class="flex justify-between items-start text-sm">
                            <div>
                                <div class="font-medium">{{ sub.code }}</div>
                                <div class="text-gray-500 text-xs">{{ sub.name }}</div>
                            </div>
                        </li>
                    </ul>
                </div>
            </template>

            <!-- Lecturer View -->
            <template v-else>
                <div class="bg-white border rounded-lg shadow-sm p-4 col-span-full">
                    <div class="flex justify-between border-b pb-2 mb-4">
                        <h3 class="font-bold text-primary">Assigned Courses & Sections</h3>
                        <span class="text-xs font-semibold bg-gray-200 px-2 py-1 rounded">Total Sections: {{ lecturerSubjects.length }}</span>
                    </div>
                    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="sub in lecturerSubjects" :key="sub.kod_subjek + sub.seksyen" 
                             class="p-4 border rounded-md bg-gray-50 hover:border-primary transition-colors">
                            <div class="flex justify-between items-start mb-2">
                                <span class="text-xs font-bold text-primary px-2 py-0.5 bg-red-50 rounded">Section {{ sub.seksyen }}</span>
                                <span class="text-[10px] text-gray-400 font-mono">{{ sub.kod_subjek }}</span>
                            </div>
                            <p class="text-sm font-bold text-gray-800 line-clamp-2 min-h-[40px]">{{ sub.nama_subjek }}</p>
                            <div class="mt-4 flex items-center justify-between">
                                <span class="text-xs text-gray-500">Students Enrolled:</span>
                                <span class="text-lg font-bold text-primary">{{ sub.bil_pelajar }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

