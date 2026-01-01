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

// --- Constants ---
const DAY_MAP_NUMERIC = {
    1: 'Sunday', 2: 'Monday', 3: 'Tuesday', 4: 'Wednesday', 5: 'Thursday', 6: 'Friday', 7: 'Saturday'
};

const DAY_FILTER_OPTIONS = [
    { value: 'all', label: 'All Days' },
    ...Object.entries(DAY_MAP_NUMERIC).map(([val, label]) => ({ value: val, label }))
];

const TIME_MAP = {
    2: '8:00 AM', 3: '9:00 AM', 4: '10:00 AM', 5: '11:00 AM', 6: '12:00 PM', 7: '1:00 PM',
    8: '2:00 PM', 9: '3:00 PM', 10: '4:00 PM', 11: '5:00 PM'
};

// --- State ---
const isLoading = ref(true);
const session = ref('2025/2026');
const semester = ref('1');
const dayFilter = ref('all');
const chartMode = ref('overall'); // 'overall' or 'details'

const rawScheduleData = ref([]);
const classDensityData = ref(null);
const user = useUserStore();

const fetchAndGenerateChart = async () => {
    isLoading.value = true;
    classDensityData.value = null;

    if (session.value === '2025/2026') {
        semester.value = 1
    }
    // API Call
    rawScheduleData.value = await getStudents('jadual_subjek', user.sessionToken, session.value, semester.value);
    console.log("Session Token, session, semester: ", user.sessionToken, session.value, semester.value)
    let processedData = rawScheduleData.value;
    const densityMap = {};

    if (chartMode.value === 'overall') {
        // --- MODE: OVERALL (Group by Day only) ---
        // We initialize all days to 0 so the chart shows empty days too
        Object.keys(DAY_MAP_NUMERIC).forEach(d => densityMap[DAY_MAP_NUMERIC[d]] = 0);

        processedData.forEach(item => {
            const dayLabel = DAY_MAP_NUMERIC[item.hari];
            if (dayLabel) densityMap[dayLabel]++;
        });
    } else {
        // --- MODE: DETAILS (Group by Time Slot) ---
        if (dayFilter.value !== 'all') {
            const filterDayNumeric = parseInt(dayFilter.value);
            processedData = rawScheduleData.value.filter(item => item.hari === filterDayNumeric);
        }

        processedData.forEach(item => {
            const dayLabel = DAY_MAP_NUMERIC[item.hari] || `Day ${item.hari}`;
            const timeLabel = TIME_MAP[item.masa] || `Slot ${item.masa}`;
            const key = (dayFilter.value === 'all') ? `${dayLabel} - ${timeLabel}` : timeLabel;
            densityMap[key] = (densityMap[key] || 0) + 1;
        });
    }

    // --- Transform and Sort ---
    const sortedArray = Object.keys(densityMap).map(key => ({
        label: key,
        count: densityMap[key],
        // Logic to help sorting
        dayIdx: Object.values(DAY_MAP_NUMERIC).indexOf(key.split(' - ')[0]),
        timeIdx: Object.keys(TIME_MAP).find(k => TIME_MAP[k] === key.split(' - ')[1]?.replace(/ (AM|PM)/, '')) || 0
    })).sort((a, b) => a.dayIdx - b.dayIdx || a.timeIdx - b.timeIdx);

    const minCount = sortedArray.length > 0 ? Math.min(...sortedArray.map(d => d.count)) : 0;

    classDensityData.value = {
        labels: sortedArray.map(d => d.label),
        datasets: [{
            label: 'Total Classes',
            backgroundColor: sortedArray.map(d => d.count === minCount ? '#DC2626' : '#3B82F6'),
            data: sortedArray.map(d => d.count),
        }]
    };

    isLoading.value = false;
};

const availableSemesters = computed(() => {
    if (session.value === '2025/2026') {
        return [{ value: '1', label: 'Semester 1' }];
    }
    return [
        { value: '1', label: 'Semester 1' },
        { value: '2', label: 'Semester 2' }
    ];
});

watch([session, semester, dayFilter, chartMode], fetchAndGenerateChart, { immediate: true });

const chartOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        title: {
            display: true,
            text: chartMode.value === 'overall' ? 'Total Class Volume per Day' : 'Detailed Class Density',
            font: { size: 16 }
        }
    }
}));

const leastBusySlotsText = computed(() => {
    if (!classDensityData.value) return "Analyzing...";
    const data = classDensityData.value.datasets[0].data;
    const minCount = Math.min(...data);
    const labels = classDensityData.value.labels;
    const best = labels.filter((_, i) => data[i] === minCount);
    return `Minimum class count: **${minCount}**. Recommendation: **${best.join(', ')}**`;
});
</script>

<template>
    <div class="p-6 space-y-6">
        <h1 class="text-3xl font-bold text-gray-800">Activity Scheduling Planner</h1>

        <Card class="shadow-lg">
            <CardHeader>
                <CardTitle>Class Time Density</CardTitle>
                <CardDescription>
                    Switch between <b>Overall</b> to see daily totals, or <b>Details</b> to see specific time slots.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="mb-6 flex flex-wrap items-end gap-4 border-b pb-6">

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Academic Session</label>
                        <Select v-model="session">
                            <SelectTrigger class="w-[160px]">
                                <SelectValue placeholder="Select Session" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2025/2026">2025/2026</SelectItem>
                                <SelectItem value="2024/2025">2024/2025</SelectItem>
                                <SelectItem value="2023/2024">2023/2024</SelectItem>
                                <SelectItem value="2023/2024">2022/2023</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Semester</label>
                        <Select v-model="semester">
                            <SelectTrigger class="w-[140px]">
                                <SelectValue placeholder="Semester" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="sem in availableSemesters" :key="sem.value" :value="sem.value">
                                    {{ sem.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="h-10 w-px bg-gray-200 mx-2 hidden md:block"></div>

                    <div class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Analysis Mode</label>
                        <Select v-model="chartMode">
                            <SelectTrigger class="w-[160px] bg-blue-50 border-blue-200 text-blue-700 font-medium">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="overall">Overall (Days)</SelectItem>
                                <SelectItem value="details">Details (Slots)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div v-if="chartMode === 'details'" class="flex flex-col gap-1.5">
                        <label class="text-xs font-bold text-gray-500 uppercase tracking-wider">Specific Day</label>
                        <Select v-model="dayFilter">
                            <SelectTrigger class="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="day in DAY_FILTER_OPTIONS" :key="day.value" :value="day.value">
                                    {{ day.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div class="space-y-4">
                    <div v-if="isLoading" class="flex flex-col items-center justify-center h-96 space-y-4">
                        <Loader2 class="animate-spin h-10 w-10 text-primary" />
                        <span class="text-sm text-gray-500 animate-pulse">Fetching schedule data...</span>
                    </div>

                    <div v-else-if="classDensityData">
                        <div
                            class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg flex items-start gap-3">
                            <div>
                                <p class="text-sm leading-relaxed" v-html="leastBusySlotsText"></p>
                            </div>
                        </div>

                        <div class="h-[500px] w-full mt-4">
                            <Bar id="class-density-chart" :options="chartOptions" :data="classDensityData" />
                        </div>
                    </div>

                    <div v-else class="text-center py-20 border-2 border-dashed rounded-xl text-gray-400">
                        No class data found for {{ session }} - Sem {{ semester }}.
                    </div>
                </div>

            </CardContent>
        </Card>
    </div>
</template>