<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Loader2 } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { Bar } from 'vue-chartjs';
import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
} from 'chart.js';
import getStudents from '@/api/api';
import { useUserStore } from '@/stores/user';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const isLoading = ref(true);
const subjects = ref([]);
const searchTerm = ref('');
const selectedSubject = ref({});
const studentChartData = ref(null);

const user = useUserStore()
const session = ref('2025/2026')
const semester = ref(1)
const currentPage = ref(1);
const itemsPerPageOptions = [10, 25, 50, 100];
const itemsPerPage = ref(itemsPerPageOptions[0]);

// --- CHANGE 1: Enhanced Chart Options for Bigger Fonts ---
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            beginAtZero: true,
            title: { 
                display: true, 
                text: 'Number of Students',
                font: { size: 14, weight: 'bold' } // Bigger axis title
            },
            ticks: {
                font: { size: 12 } // Bigger Y-axis numbers
            }
        },
        x: {
            ticks: {
                font: { size: 12, weight: 'bold' } // Bigger X-axis labels (Section names)
            }
        }
    },
    plugins: {
        legend: {
            labels: {
                font: { size: 14 } // Bigger legend text
            }
        },
        title: {
            display: true,
            text: 'Percentage of Students per Section',
            font: { size: 18 } // Bigger chart title
        }
    }
};

const fetchingData = async () => {
    try {
        isLoading.value = true;
        subjects.value = await getStudents('subjek_seksyen', user.sessionToken, session.value, semester.value)
    } catch (error) {
        console.error("Failed to fetch subjects:", error);
    } finally {
        isLoading.value = false;
        currentPage.value = 1;
    }
}

onMounted(async () => {
    fetchingData();
});

watch([session, semester], async () => {
    fetchingData()
})

const totalPages = computed(() => {
    return Math.ceil(filteredSubjects.value.length / itemsPerPage.value);
});

const filteredSubjects = computed(() => {
    if (!searchTerm.value) return subjects.value;
    const search = searchTerm.value.toLowerCase();
    return subjects.value.filter(subject =>
        subject.nama_subjek.toLowerCase().includes(search) ||
        subject.kod_subjek.toLowerCase().includes(search)
    );
});

const paginatedSubjects = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    
    // Pagination safety check
    if (currentPage.value > totalPages.value && totalPages.value > 0) {
        currentPage.value = totalPages.value;
    } else if (totalPages.value === 0) {
        currentPage.value = 1;
    }
    return filteredSubjects.value.slice(start, end);
});

// --- CHANGE 2: Helper function to sort sections numerically ---
// This handles mixed types like "1", "2", "10" correctly
const getSortedSections = (sectionList) => {
    if (!sectionList) return [];
    return [...sectionList].sort((a, b) => {
        // Remove non-numeric chars to safely compare (e.g. if data is "S1", "S2")
        // or just parse directly if they are pure numbers
        const numA = parseInt(a.seksyen.toString().replace(/\D/g, '')) || 0;
        const numB = parseInt(b.seksyen.toString().replace(/\D/g, '')) || 0;
        return numA - numB;
    });
};

const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages.value) currentPage.value = pageNumber;
};

const changeItemsPerPage = (event) => {
    itemsPerPage.value = parseInt(event.target.value);
    currentPage.value = 1;
};

const viewDetails = (subject, index) => {
    selectedSubject.value = subject;
    generateChartData(selectedSubject.value);
};

const closeDetails = () => {
    selectedSubject.value = null;
    studentChartData.value = null;
};

const generateChartData = (subjectData) => {
    // Sort the data before generating chart
    const sortedList = getSortedSections(subjectData.seksyen_list);
    
    const labels = sortedList.map(s => `Section ${s.seksyen}`);
    const data = sortedList.map(s => s.bil_pelajar);
    
    if(data.length === 0){
        studentChartData.value = null;
        return;
    }
    
    const backgroundColors = ['#0369A1', '#10B981', '#FBBF24', '#EF4444', '#6366F1'];

    studentChartData.value = {
        labels: labels,
        datasets: [{
            label: 'Number of Students',
            backgroundColor: backgroundColors.slice(0, data.length),
            data: data,
            // --- CHANGE 3: Increase Bar Thickness ---
            barPercentage: 0.8, // Make bars occupy 80% of the category width (thicker)
            categoryPercentage: 0.9 
        }]
    };
};
</script> 

<template>
    <div class="p-4 sm:p-8 space-y-6">
        <div v-if="isLoading" class="flex items-center justify-center h-96">
            <svg class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>

        <div v-else-if="!selectedSubject">
             <Card class="shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl sm:text-2xl">Subject Catalog</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        <Input v-model="searchTerm" placeholder="Search by course name or code..." class="max-w-md flex-grow" />
                        <div class="flex gap-3">
                            <select class="border rounded-md px-3 py-2 text-sm" v-model="session">
                                <option value="2025/2026">2025/2026</option>
                                <option value="2024/2025">2024/2025</option>
                                <option value="2023/2024">2023/2024</option>
                                <option value="2022/2023">2022/2023</option>
                                <option value="2021/2022">2021/2022</option>
                                <option value="2020/2021">2020/2021</option>
                            </select>
                            <select class="border rounded-md px-3 py-2 text-sm" v-model="semester">
                                <option value="1">Semester 1</option>
                                <option value="2">Semester 2</option>
                            </select>
                        </div>
                    </div>

                    <div class="overflow-x-auto border rounded-lg">
                        <Table class="min-w-full divide-y divide-gray-200">
                            <TableHeader>
                                <TableRow class="bg-gray-50">
                                    <TableHead class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</TableHead>
                                    <TableHead class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
                                    <TableHead class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sections</TableHead>
                                    <TableHead class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody class="bg-white divide-y divide-gray-200">
                                <TableRow v-for="(subject, index) in paginatedSubjects" :key="subject.code" class="hover:bg-gray-50">
                                    <TableCell class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{{ subject.kod_subjek }}</TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-gray-700">{{ subject.nama_subjek }}</TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-center text-gray-700">{{ subject.sessions }}</TableCell>
                                    <TableCell class="px-6 py-4 whitespace-nowrap text-right">
                                        <Button type="button" size="sm" @click="viewDetails(subject, index)">View Detail</Button>
                                    </TableCell>
                                </TableRow>
                                <TableRow v-if="filteredSubjects.length === 0">
                                    <TableCell colspan="4" class="text-center text-gray-500 py-4">No subjects found matching your search.</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                    <div v-if="totalPages > 1" class="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 pt-4 mt-4">
                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-medium">Items per page:</span>
                            <select class="border rounded-md px-2 py-1 text-sm focus:ring-primary focus:border-primary" :value="itemsPerPage" @change="changeItemsPerPage">
                                <option v-for="option in itemsPerPageOptions" :key="option" :value="option">{{ option }}</option>
                            </select>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-medium">Page {{ currentPage }} of {{ totalPages }}</span>
                            <Button variant="outline" size="sm" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">Previous</Button>
                            <Button variant="outline" size="sm" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div v-else>
            <Button variant="outline" @click="closeDetails" class="mb-6">&larr; Back to List</Button>
            <h2 class="text-3xl sm:text-4xl font-extrabold mb-6 text-primary">
                {{ selectedSubject.nama_subjek }} ({{ selectedSubject.kod_subjek }})
            </h2>

            <Card class="mb-6 shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl">Student Distribution by Section</CardTitle>
                </CardHeader>
                <CardContent class="h-80 md:h-96 flex justify-center">
                    <div v-if="studentChartData" class="w-full max-w-lg h-full">
                        <Bar id="session-comparison-chart" :options="chartOptions" :data="studentChartData" />
                    </div>
                    <div v-else class="flex items-center justify-center h-full text-gray-500">
                        Chart data is not available.
                    </div>
                </CardContent>
            </Card>

            <Card class="shadow-lg">
                <CardHeader>
                    <CardTitle class="text-xl">Section Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div v-for="sessionData in getSortedSections(selectedSubject.seksyen_list)" 
                             :key="sessionData.seksyen"
                             class="bg-card p-5 border border-gray-200 rounded-lg shadow-sm">
                            <p class="font-bold text-lg text-gray-800">Section {{ sessionData.seksyen }}</p>
                            <p class="text-3xl font-extrabold text-blue-600 mt-1">{{ sessionData?.bil_pelajar }}</p>
                            <p class="text-sm text-gray-500">Total Students Enrolled</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>