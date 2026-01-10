<script setup>
import BarChart from "@/components/chart/students/CoursesStudent.vue";
import { Button } from "@/components/ui/button"; // shadcn Button import
import { useUserStore } from "@/stores/user";
import { ChartLine, GraduationCap, House, LibraryBig, Loader2, School, Sheet, Users, UserStar } from "lucide-vue-next";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const students = ref([])
// students info
const studentSession = ref('')
const studentYear = ref(0)
const studentSem = ref('')

const drawerOpen = ref(false)
const user = useUserStore()
const router = useRouter()
const admissionInfo = ref({ session: "Loading...", semester: "-", year: "-" });
const semesters = ref([]);
const chartOptions = ref({ responsive: true });
const isLoading = ref(true)

function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
}
const handleLogout = () => {
    // Add your logout logic here, e.g., clearing auth tokens
    console.log("user logging out")
    user.logout()
    toast.success("Logged out successfully!", { id: "logout-success" })
    router.push("login")
};

const goToPages = (page) => {
    router.push(page)
}


onMounted(async () => {
    try {
        const response = await axios.get(import.meta.env.VITE_BASE_URL, {
            params: {
                'entity': 'pelajar_subjek',
                'no_matrik': localStorage.getItem('matric_no')
            }
        })
        // console.log(`response data: ${JSON.stringify(response.data, null, 2)}`)
        students.value = response.data
        console.log("student is")
        if (students.value.length > 0) {
            console.log('First student object:', students.value[0].sesi);
        }
        studentSession.value = students.value[0].sesi
        studentYear.value = students.value[0].tahun_kursus
        studentSem.value = students.value[0].semester
        console.log(`isloading? ${isLoading.value}`)
    } catch (error) {
        console.log("Error fetching students list: ", error);
        toast.error("Failed to load students list.", {
            id: "students-load-failed",
        });
    } finally {
        isLoading.value = false;
    }
});

const groupedSemesters = computed(() => {
    // Check if data is available and is an array
    if (!students.value[0].sesi || !Array.isArray(students.value)) {
        return [];
    }

    // Use a Map to group subjects by Year and then by Semester
    const yearSemesterMap = new Map();

    students.value.forEach(subject => {
        const year = subject.tahun_kursus;
        const semester = subject.semester;

        // Use a combined key for uniqueness (e.g., "Year 3 - Semester 1")
        const key = `Year ${year} - Semester ${semester}`;

        if (!yearSemesterMap.has(key)) {
            yearSemesterMap.set(key, {
                // Assuming credit and type aren't in the data, we'll use placeholder/logic
                sem_id: key.replace(/[^a-zA-Z0-9]/g, '_'), // Safe ID for key
                name: key, // e.g., "Year 3 - Semester 1"
                total_credit: 0, // We need to calculate this
                subjects: []
            });
        }

        const semGroup = yearSemesterMap.get(key);

        // Map the raw data keys to the keys needed by your template
        const structuredSubject = {
            code: subject.kod_subjek,
            name: subject.nama_subjek,
            // NOTE: Your raw data is missing 'credit' and 'type' (Core/Elective). 
            // I'm using placeholder values here. You must update this logic.
            credit: 3, // PLACEHOLDER: Update with actual credit value
            type: subject.kod_subjek.startsWith('SECJ') ? 'Core' : 'Elective' // EXAMPLE LOGIC
        };

        semGroup.subjects.push(structuredSubject);
        semGroup.total_credit += structuredSubject.credit; // Accumulate credits
    });

    // 3. Convert Map values to an Array and sort them logically (Year then Semester)
    const groupedArray = Array.from(yearSemesterMap.values());

    // Sort by year ascending, then semester ascending
    groupedArray.sort((a, b) => {
        const yearA = parseInt(a.name.match(/Year (\d+)/)[1]);
        const yearB = parseInt(b.name.match(/Year (\d+)/)[1]);
        const semA = parseInt(a.name.match(/Semester (\d+)/)[1]);
        const semB = parseInt(b.name.match(/Semester (\d+)/)[1]);

        if (yearA !== yearB) {
            return yearA - yearB;
        }
        return semA - semB;
    });

    return groupedArray;
});

const chartData = computed(() => {
    if (!students.value[0].sesi || students.value.length === 0) {
        return null; // Return null if data isn't ready
    }
    // 1. Group the subjects by 'tahun_kursus' (Course Year)
    const subjectCountByYear = students.value.reduce((acc, subject) => {
        const year = `Year ${subject.tahun_kursus}`;
        acc[year] = (acc[year] || 0) + 1;
        return acc;
    }, {});

    // 2. Prepare the arrays for Chart.js
    const labels = Object.keys(subjectCountByYear).sort(); // Sort labels (e.g., Year 1, Year 2, Year 3)
    const data = labels.map(label => subjectCountByYear[label]);

    // 3. Structure the data object for Bar Chart
    return {
        labels: labels,
        datasets: [
            {
                label: 'Number of Subjects Taken',
                backgroundColor: '#0096FF', 
                borderColor: '#059669',
                borderWidth: 1,
                data: data,
            }
        ]
    };
});

onMounted(() => {
    groupedSemesters
    chartData
})

</script>

<template>
    <div v-if="isLoading" class="flex items-center justify-center h-screen">
        <Loader2 class="animate-spin text-primary h-8 w-8" />
    </div>

    <div class="p-6 space-y-6" v-if="!isLoading">
        <h1 class="text-2xl font-bold text-primary">Welcome back {{ user.name }}</h1>

        <div class="bg-white p-4 rounded shadow border-l-4 border-primary">
            <h2 class="text-lg font-semibold">Admission Info</h2>
            
            <div class="flex flex-wrap gap-4 md:gap-6 mt-2 text-gray-700">
                <div><span class="font-bold" v-if="studentSession !== ''">Session:</span> {{ studentSession }}</div>
                <div><span class="font-bold" v-if="studentYear !== 0">Current Year:</span> {{ studentYear }}</div>
                <div><span class="font-bold" v-if="studentSem != 0">Semester:</span> {{ studentSem }}</div>
            </div>
        </div>

        <div class="p-4 bg-white rounded-lg shadow-md w-full flex items-center justify-center">
            <div v-if="!chartData" class="text-center text-gray-500 w-full">
                <div class="flex items-center justify-center">
                    <Loader2 class="animate-spin text-primary h-8 w-8" />
                </div>
            </div>

            <div v-else class="w-full h-80 flex items-center justify-center">
                <Bar id="subject-load-chart" :options="chartOptions" :data="chartData" />
            </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6">
            <div v-for="sem in groupedSemesters" :key="sem.sem_id" class="bg-white border rounded-lg shadow-sm p-4">
                <div class="flex justify-between border-b pb-2 mb-2">
                    <h3 class="font-bold text-primary">{{ sem.name }}</h3>
                    <span class="text-xs font-semibold bg-gray-200 px-2 py-1 rounded">Number of Subjects: {{ sem.subjects.length
                        }}</span>
                </div>
                <ul class="space-y-3">
                    <li v-for="sub in sem.subjects" :key="sub.code" class="flex justify-between items-start text-sm">
                        <div>
                            <div class="font-medium">{{ sub.code }}</div>
                            <div class="text-gray-500 text-xs">{{ sub.name }}</div>
                        </div>
                        <!-- <div class="text-right">
                            <span class="block font-bold">{{ sub.credit }} Credit</span>
                        </div> -->
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>


<style scoped>
/* optional: make navbar sticky */
nav {
    position: sticky;
    top: 0;
    z-index: 50;
}
</style>
