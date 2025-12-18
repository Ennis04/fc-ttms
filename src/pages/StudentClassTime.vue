<script setup>
import { ref, watch, computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-vue-next';
import { useUserStore } from '@/stores/user';
import getStudents from '@/api/api';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

// --- Constants for Mapping ---
const DAY_MAP_NUMERIC = { // Numeric key for internal logic
    1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'
};
// Array of objects for use in the Select component
const DAY_FILTER_OPTIONS = [
    { value: 'all', label: 'All Days' }, // New option to show all days
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '7', label: 'Sunday' },
];

const TIME_MAP = {
    2: '8:00 AM', 3: '9:00 AM', 4: '10:00 AM', 5: '11:00 AM', 6: '12:00 PM', 7: '1:00 PM', 
    8: '2:00 PM', 9: '3:00 PM', 10: '4:00 PM', 11: '5:00 PM'
};

// --- 1. Reactive State (Updated) ---
const isLoading = ref(true);
const session = ref('2025/2026');
const semester = ref('1');
const dayFilter = ref('all'); // NEW: Default to showing all days

const rawScheduleData = ref([]); 
const classDensityData = ref(null);

const user = useUserStore()
const fetchAndGenerateChart = async () => {
    isLoading.value = true;
    classDensityData.value = null;
    rawScheduleData.value = await getStudents('jadual_subjek', user.sessionToken, session.value, semester.value)
    
    let processedData = rawScheduleData.value;
    
    // NEW: Filter the data by the selected day (if not 'all')
    if (dayFilter.value !== 'all') {
        const filterDayNumeric = parseInt(dayFilter.value);
        processedData = rawScheduleData.value.filter(item => item.hari === filterDayNumeric);
    }

    // --- Aggregation Logic (only runs on the filtered or full dataset) ---
    const densityMap = {};
    
    processedData.forEach(item => {
        const dayLabel = DAY_MAP_NUMERIC[item.hari] || `Day ${item.hari}`;
        const timeLabel = TIME_MAP[item.masa] || `Slot ${item.masa}`;
        
        // Key changes depending on filter: Day-Time (if all) or just Time (if filtered)
        const key = (dayFilter.value === 'all') 
            ? `${dayLabel} - ${timeLabel}`
            : timeLabel; 

        densityMap[key] = (densityMap[key] || 0) + 1;
    });

    // 2. Sorting Logic
    const sortedDensityArray = Object.keys(densityMap).map(key => {
        let dayName, time;
        let hariNumeric = 0;
        
        if (dayFilter.value === 'all') {
            [dayName, time] = key.split(' - ');
            hariNumeric = Object.keys(DAY_MAP_NUMERIC).find(k => DAY_MAP_NUMERIC[k] === dayName);
        } else {
            time = key;
        }

        return {
            key,
            dayName,
            time,
            count: densityMap[key],
            hariNumeric: hariNumeric,
            masaNumeric: Object.keys(TIME_MAP).find(k => TIME_MAP[k] === time.replace(/ (AM|PM)/, '')) 
        };
    }).sort((a, b) => {
        // Sort by Day first (if showing all days)
        if (dayFilter.value === 'all' && a.hariNumeric !== b.hariNumeric) {
            return a.hariNumeric - b.hariNumeric;
        }
        // Always sort by time slot second
        return a.masaNumeric - b.masaNumeric;
    });


    // 3. Find the least busy time slot
    let minCount = Infinity;
    if (sortedDensityArray.length > 0) {
        minCount = Math.min(...sortedDensityArray.map(d => d.count));
    }
    
    // 4. Transform data for Chart.js
    // Labels are formatted differently based on the filter
    const labels = sortedDensityArray.map(d => 
        (dayFilter.value === 'all') ? `${d.dayName}\n(${d.time})` : d.time
    );
    const counts = sortedDensityArray.map(d => d.count);
    
    const backgroundColors = counts.map(count => 
        count === minCount ? '#DC2626' : '#3B82F6' // Red for least busy
    );

    classDensityData.value = {
        labels: labels,
        datasets: [{
            label: 'Total Classes Scheduled',
            backgroundColor: backgroundColors,
            data: counts,
        }]
    };

    isLoading.value = false;
};

// --- 3. Lifecycle and Watchers (Updated Dependency Array) ---

watch(
    // ADDED dayFilter to the dependencies list
    [session, semester, dayFilter],
    () => {
        classDensityData.value = null; 
        fetchAndGenerateChart();
    },
    { immediate: true }
);

// --- 4. Chart Options and Least Busy Slot Text (Updated Title) ---

const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: {
            beginAtZero: true,
            title: { display: true, text: 'Number of Classes' },
            ticks: { precision: 0 }
        }
    },
    plugins: {
        legend: { display: false },
        title: {
            display: true,
            // Dynamic title based on filter
            text: (dayFilter.value === 'all') 
                  ? 'Class Density by Day and Time Slot' 
                  : `${DAY_MAP_NUMERIC[parseInt(dayFilter.value)]} Class Density by Time Slot`,
            font: { size: 16 }
        },
        tooltip: {
             callbacks: {
                afterLabel: (context) => {
                    const count = context.parsed.y;
                    if (classDensityData.value && count === Math.min(...classDensityData.value.datasets[0].data)) {
                        return ' (Optimal Activity Slot)';
                    }
                    return null;
                }
            }
        }
    }
}));

const leastBusySlotsText = computed(() => {
    if (!classDensityData.value) return "Analyzing data...";
    
    const data = classDensityData.value.datasets[0].data;
    const minCount = Math.min(...data);

    const labels = classDensityData.value.labels;
    const leastBusy = labels.filter((label, index) => data[index] === minCount);

    return `The least number of classes is **${minCount}**. Best slots: **${leastBusy.join('; ')}** (Highlighted in RED)`;
});
</script>

<template>
    <div class="p-6 space-y-6">
        <h1 class="text-3xl font-bold text-gray-800">Activity Scheduling Planner</h1>

        <Card class="shadow-lg">
            <CardHeader>
                <CardTitle class="flex items-center space-x-2">
                    Class Time Density
                </CardTitle>
                <CardDescription>
                    Analyze class frequency across time slots to find the optimal window for organizing events.
                </CardDescription>
            </CardHeader>
            <CardContent>
                
                <div class="mb-6 flex flex-wrap items-center gap-4 border-b pb-4">
                    <span class="text-sm font-medium text-gray-700">Filter by:</span>
                    
                    <Select v-model="session">
                        <SelectTrigger class="w-[180px]">
                            <SelectValue placeholder="Select Session" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="2025/2026">2025/2026</SelectItem>
                                <SelectItem value="2024/2025">2024/2025</SelectItem>
                                <SelectItem value="2023/2024">2023/2024</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select v-model="semester">
                        <SelectTrigger class="w-[180px]">
                            <SelectValue placeholder="Select Semester" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="1">Semester 1</SelectItem>
                                <SelectItem value="2">Semester 2</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>

                    <Select v-model="dayFilter">
                        <SelectTrigger class="w-[180px]">
                            <SelectValue placeholder="Select Day" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem v-for="day in DAY_FILTER_OPTIONS" :key="day.value" :value="day.value">
                                    {{ day.label }}
                                </SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                
                <div class="space-y-4">
                    <div v-if="isLoading" class="flex items-center justify-center h-96">
                        <Loader2 class="animate-spin h-8 w-8 text-primary" />
                    </div>

                    <div v-else-if="classDensityData">
                        <div class="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md">
                            <p class="font-semibold" v-html="leastBusySlotsText"></p>
                        </div>
                        
                        <div class="h-[500px] w-full">
                            <Bar 
                                id="class-density-chart"
                                :options="chartOptions"
                                :data="classDensityData"
                            />
                            
                        </div>
                    </div>
                    
                    <div v-else class="text-center py-10 text-gray-500">
                        No class data available for the selected session, semester, and day.
                    </div>
                </div>

            </CardContent>
        </Card>
    </div>
</template>