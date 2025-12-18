<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Loader2 } from 'lucide-vue-next'; // Assuming you use lucide icons
// shadcn-vue components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// Chart components
import { Doughnut } from 'vue-chartjs';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement, // NEW: Needed for Doughnut/Pie charts
    CategoryScale,
    LinearScale
} from 'chart.js';
import getStudents from '@/api/api'; 
import { useUserStore } from '@/stores/user'; 

ChartJS.register(Title, Tooltip, Legend, ArcElement, CategoryScale, LinearScale);

// Mock API function to simulate fetching data
const getMockSubjects = (session, semester) => {
    // Simulate network delay
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`Mocking data fetch for Session: ${session}, Semester: ${semester}`);
            // In a real scenario, you might filter the mock data based on session/semester
            resolve(mockSubjectData);
        }, 1000); // 1 second delay
    });
};

const isLoading = ref(true);
const subjects = ref([]); 
const searchTerm = ref('');
const selectedSubject = ref({});

const studentChartData = ref(null);
const chartOptions = { responsive: true, maintainAspectRatio: false };

const user = useUserStore()

// user selection
const session = ref('2025/2026')
const semester = ref(1)
const limit = ref(100) // Unused in this mock, but kept for context
const currentPage = ref(1);
const itemsPerPageOptions = [10, 25, 50, 100];
const itemsPerPage = ref(itemsPerPageOptions[0]);

const fetchingData = async () => {
    try {
        isLoading.value = true;
        subjects.value = await getStudents('subjek_seksyen', user.sessionToken, session.value, semester.value)
        // subjects.value = await getMockSubjects(session.value, semester.value) // Use mock function

    } catch (error) {
        console.error("Failed to fetch subjects:", error);
    } finally {
        isLoading.value = false;
        // Important: Reset pagination after fetching new data
        currentPage.value = 1;
    }
}

onMounted(async () => {
    // Initial data fetch using the mock function
    fetchingData();
});

watch(
    [session, semester],
    async () => {
        console.log(`session: ${session.value} sem: ${semester.value}`)
        fetchingData()

    }
)

const totalPages = computed(() => {
    // Math.ceil rounds up to ensure any remaining items get their own page
    return Math.ceil(filteredSubjects.value.length / itemsPerPage.value);
});

const filteredSubjects = computed(() => {
    if (!searchTerm.value) {
        return subjects.value;
    }

    const search = searchTerm.value.toLowerCase();
    return subjects.value.filter(subject =>
        subject.nama_subjek.toLowerCase().includes(search) ||
        subject.kod_subjek.toLowerCase().includes(search)
    );
});

const paginatedSubjects = computed(() => {
    // 1. Recalculate start and end indices
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;

    // 2. Adjust currentPage if it somehow exceeds totalPages (e.g., if filters reduce the list size)
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
        currentPage.value = totalPages.value;
    } else if (totalPages.value === 0) {
        currentPage.value = 1;
    }

    // 3. Slice and return the data for the current page
    return filteredSubjects.value.slice(start, end);
});

const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages.value) {
        currentPage.value = pageNumber;
    }
};

const changeItemsPerPage = (event) => {
    // Update the ref with the new value (must be an integer)
    itemsPerPage.value = parseInt(event.target.value);
    currentPage.value = 1; // Always reset to page 1 when changing the limit
};

const viewDetails = (subject, index) => {
    // console.log(`testing ${JSON.stringify(subject)}`)
    selectedSubject.value = subject;
    console.log(`selectedSubject: ${JSON.stringify(selectedSubject.value)}`)
    generateChartData(selectedSubject.value);
};

const closeDetails = () => {
    selectedSubject.value = null;
    studentChartData.value = null;
};

const generateChartData = (subjectData) => {
    const labels = subjectData.seksyen_list.map(s => `Session ${s.seksyen}`);
    const data = subjectData.seksyen_list.map(s => s.bil_pelajar);
    if(data.length === 0){
        studentChartData.value = null;
        return;
    }
    // Using a set of colors for the Doughnut chart
    const backgroundColors = [
        '#0369A1', // sky-700
        '#10B981', // emerald-500
        '#FBBF24', // amber-400
        '#EF4444', // red-500
        '#6366F1', // indigo-500
    ];

    studentChartData.value = {
        labels: labels,
        datasets: [{
            label: 'Number of Students',
            // Use an array of colors for Doughnut chart
            backgroundColor: backgroundColors.slice(0, data.length),
            data: data,
            hoverOffset: 4
        }]
    };
};
</script> 

<template>
    <div class="p-4 sm:p-8 space-y-6">

        <div v-if="isLoading" class="flex items-center justify-center h-96">
            <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none"
                viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
            </svg>
        </div>

        <div v-else-if="!selectedSubject">
            <Card class="shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl sm:text-2xl">Subject Catalog</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <Input v-model="searchTerm" placeholder="Search by course name or code..."
                            class="max-w-md flex-grow" />

                        <div class="flex gap-3">
                            <select name="session" id="session-select" class="border rounded-md px-3 py-2 text-sm"
                                v-model="session">
                                <option value="2025/2026">2025/2026</option>
                                <option value="2024/2025">2024/2025</option>
                                <option value="2023/2024">2023/2024</option>
                                <option value="2022/2023">2022/2023</option>
                                <option value="2021/2022">2021/2022</option>
                                <option value="2020/2021">2020/2021</option>
                            </select>

                            <select name="semester" id="semester-select" class="border rounded-md px-3 py-2 text-sm"
                                v-model="semester">
                                <option value="1">Semester 1</option>
                                <option value="2">Semester 2</option>
                            </select>
                        </div>
                    </div>

                    <div class="overflow-x-auto border rounded-lg">
                        <Table class="min-w-full divide-y divide-gray-200">
                            <TableHeader>
                                <TableRow class="bg-gray-50">
                                    <TableHead
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Code
                                    </TableHead>
                                    <TableHead
                                        class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </TableHead>
                                    <TableHead
                                        class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sessions
                                    </TableHead>
                                    <TableHead
                                        class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody class="bg-white divide-y divide-gray-200">
                                <TableRow v-for="(subject, index) in paginatedSubjects" :key="subject.code"
                                    class="hover:bg-gray-50">
                                    <TableCell class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{{
                                        subject.kod_subjek }}</TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-gray-700">{{ subject.nama_subjek
                                        }}
                                    </TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-center text-gray-700">{{
                                        subject.sessions }}</TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-right">
                                        <Button type="button" size="sm" @click="viewDetails(subject, index)">View
                                            Detail</Button>
                                    </TableCell>
                                </TableRow>
                                <TableRow v-if="filteredSubjects.length === 0">
                                    <TableCell colspan="4" class="text-center text-gray-500 py-4">
                                        No subjects found matching your search.
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div v-if="totalPages > 1"
                        class="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 pt-4 mt-4">

                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-medium">Items per page:</span>
                            <select class="border rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary"
                                :value="itemsPerPage" @change="changeItemsPerPage">
                                <option v-for="option in itemsPerPageOptions" :key="option" :value="option">
                                    {{ option }}
                                </option>
                            </select>
                        </div>

                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-medium">
                                Page {{ currentPage }} of {{ totalPages }}
                            </span>

                            <Button variant="outline" size="sm" :disabled="currentPage === 1"
                                @click="goToPage(currentPage - 1)">
                                Previous
                            </Button>
                            <Button variant="outline" size="sm" :disabled="currentPage === totalPages"
                                @click="goToPage(currentPage + 1)">
                                Next
                            </Button>
                        </div>
                    </div>

                </CardContent>
            </Card>
        </div>

        <div v-else>
            <Button variant="outline" @click="closeDetails" class="mb-6">
                &larr; Back to List
            </Button>

            <h2 class="text-3xl sm:text-4xl font-extrabold mb-6 text-primary">
                {{ selectedSubject.nama_subjek }} ({{ selectedSubject.kod_subjek }})
            </h2>

            <Card class="mb-6 shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl">Student Distribution by Session</CardTitle>
                </CardHeader>
                <CardContent class="h-80 md:h-96 flex justify-center">
                    <div v-if="studentChartData" class="w-full max-w-lg h-full">

                        <Doughnut id="session-comparison-chart" :options="{
                            ...chartOptions,
                            plugins: {
                                title: { display: true, text: 'Percentage of Students per Session' }
                            },
                            cutout: '70%' // Gives it the doughnut shape
                        }" :data="studentChartData" />

                    </div>
                    <div v-else class="flex items-center justify-center h-full text-gray-500">
                        Chart data is not available.
                    </div>
                </CardContent>
            </Card>

            <Card class="shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl">Session Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="session in selectedSubject.seksyen_list" :key="session.seksyen"
                            class="bg-card p-5 border border-gray-200 rounded-lg shadow-sm">
                            <p class="font-bold text-lg text-gray-800">Session {{
                                session.seksyen }}</p>
                            <p class="text-3xl font-extrabold text-blue-600 mt-1">{{
                                session?.bil_pelajar }}</p>
                            <p class="text-sm text-gray-500">Total Students Enrolled</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>


<style lang="scss" scoped></style>