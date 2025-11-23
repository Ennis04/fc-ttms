<script setup>
import { ref, onMounted, computed } from "vue";
import { 
    Search, Filter, Eye, ArrowLeft, Loader2, ArrowUpDown, X
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios"; 
import { useUserStore } from "@/stores/user";

// --- STATE MANAGEMENT ---
const userStore = useUserStore();
const selectedItem = ref(null);
const searchQuery = ref("");
const loading = ref(false);
const error = ref("");
const timetableData = ref([]);

// --- SORTING STATE ---
const sortBy = ref('time'); 

// --- FILTER STATE ---
const isFilterOpen = ref(false); 
const selectedDay = ref(null);   

// --- MAPPING FOR DROPDOWN ---
const availableDays = [
    { value: 2, label: "Monday" },
    { value: 3, label: "Tuesday" },
    { value: 4, label: "Wednesday" },
    { value: 5, label: "Thursday" },
    { value: 6, label: "Friday" }, 
];

// --- SEARCH, FILTER & SORT LOGIC ---
const filteredTimetable = computed(() => {
    let data = [...timetableData.value];

    // 1. Filter by Search Query
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        data = data.filter(item => {
            const nameMatch = item.nama_subjek.toLowerCase().includes(query);
            const codeMatch = item.kod_subjek.toLowerCase().includes(query);
            return nameMatch || codeMatch;
        });
    }

    // 2. Filter by Day
    if (selectedDay.value !== null) {
        data = data.filter(item => item.hari == selectedDay.value);
    }

    // 3. Sorting Logic
    if (sortBy.value === 'subject') {
        data.sort((a, b) => a.nama_subjek.localeCompare(b.nama_subjek));
    } else {
        data.sort((a, b) => {
            if (a.hari != b.hari) return a.hari - b.hari;
            return a.masa - b.masa;
        });
    }

    return data;
});

// --- HELPER: CONVERT UTM DAYS ---
const formatDay = (day) => {
    const days = {
        1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday",
        "AHAD": "Sunday", "ISNIN": "Monday", "SELASA": "Tuesday", "RABU": "Wednesday", "KHAMIS": "Thursday"
    };
    return days[day] || day; 
}

// --- HELPER: FORMAT TIME ---
const formatSingleBlock = (apiMasa) => {
    const startHour = parseInt(apiMasa) + 6; 
    const pad = (n) => n < 10 ? '0' + n : n;
    return `${pad(startHour)}00 - ${pad(startHour)}50`;
}

// --- API FETCH LOGIC ---
const fetchTimetable = async () => {
    loading.value = true;
    error.value = "";
    
    if (!userStore.matric_no) {
        error.value = "Session lost. Please Logout and Login again.";
        loading.value = false;
        return;
    }

    try {
        // 1. Get Subjects
        const subjectsRes = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: { entity: 'pelajar_subjek', no_matrik: userStore.matric_no }
        });

        const allSubjects = subjectsRes.data;

        if (!allSubjects || allSubjects.length === 0) {
            error.value = "No subjects found.";
            loading.value = false;
            return;
        }

        // 2. Auto-Detect Current Session
        const currentSesi = allSubjects[0].sesi;     
        const currentSem = allSubjects[0].semester;  
        const currentSubjects = allSubjects.filter(sub => 
            sub.sesi === currentSesi && sub.semester == currentSem
        );

        // 3. Fetch Details
        const detailedRequests = currentSubjects.map(async (subject) => {
            const schedulePromise = axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                params: {
                    entity: 'jadual_subjek',
                    sesi: currentSesi,
                    semester: currentSem,
                    kod_subjek: subject.kod_subjek,
                    seksyen: subject.seksyen
                }
            });

            const lecturerPromise = axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                params: {
                    entity: 'subjek_pensyarah',
                    sesi: currentSesi,
                    semester: currentSem,
                    kod_subjek: subject.kod_subjek,
                    seksyen: subject.seksyen
                }
            });

            const [scheduleRes, lecturerRes] = await Promise.all([schedulePromise, lecturerPromise]);
            const schedules = scheduleRes.data || [];
            
            let lecturerName = "Not Assigned";
            if (lecturerRes.data && lecturerRes.data.length > 0) {
                const lect = lecturerRes.data[0];
                lecturerName = lect.nama || lect.nama_pensyarah || lect.nama_staf || "Unknown";
            }

            if (schedules.length === 0) {
                return [{
                    ...subject,
                    hari: "TBA", masa: 0, ruang: null, lecturer_name: lecturerName
                }];
            }

            return schedules.map(slot => ({
                ...subject,       
                ...slot,
                masa: parseInt(slot.masa),
                lecturer_name: lecturerName 
            }));
        });

        const nestedResults = await Promise.all(detailedRequests);
        // We don't sort here anymore, the computed property handles it!
        timetableData.value = nestedResults.flat();

    } catch (err) {
        console.error(err);
        error.value = "Failed to fetch data. Ensure CORS Extension is ON.";
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    fetchTimetable();
});

const viewDetails = (item) => {
    selectedItem.value = item;
}
const goBack = () => {
    selectedItem.value = null;
}

// Actions for Filter
const toggleFilter = () => {
    isFilterOpen.value = !isFilterOpen.value;
}
const selectDay = (dayValue) => {
    selectedDay.value = dayValue;
    isFilterOpen.value = false; 
}
const clearFilter = () => {
    selectedDay.value = null;
    isFilterOpen.value = false;
}
</script>

<template>
    <div class="p-4 md:p-6 max-w-4xl mx-auto min-h-screen" @click="isFilterOpen = false">
        
        <div v-if="loading" class="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin mb-2 text-primary" />
            <p>Loading your timetable...</p>
        </div>

        <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-md border border-red-200 text-center">
            {{ error }}
        </div>

        <div v-else-if="!selectedItem">
            
            <div class="mb-6">
                 <h1 class="text-2xl font-bold text-primary">Timetable</h1>
                 <p class="text-gray-500 text-sm" v-if="timetableData.length > 0">
                    Session {{ timetableData[0].sesi }} | Semester {{ timetableData[0].semester }}
                 </p>
            </div>

            <div class="bg-purple-50/50 p-4 rounded-lg mb-6 flex flex-col md:flex-row gap-4 items-center relative z-10">
                <div class="relative w-full md:w-auto" @click.stop>
                    <Button 
                        variant="outline" 
                        class="bg-white flex gap-2 w-full md:w-auto transition-colors border"
                        :class="selectedDay !== null ? 'bg-primary text-white hover:bg-red-900 hover:text-white' : 'text-gray-600'"
                        @click="toggleFilter"
                    >
                        <Filter class="w-4 h-4" />
                        <span v-if="selectedDay === null">Filter</span>
                        <span v-else>{{ formatDay(selectedDay) }}</span>
                        <div v-if="selectedDay !== null" @click.stop="clearFilter" class="ml-2 hover:bg-white/20 rounded-full p-0.5">
                            <X class="w-3 h-3" />
                        </div>
                    </Button>

                    <div v-if="isFilterOpen" class="absolute top-full mt-2 left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                        <div class="py-1">
                            <button class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors" @click="clearFilter">
                                Show All Days
                            </button>
                            <div class="border-t border-gray-100 my-1"></div>
                            <button v-for="day in availableDays" :key="day.value" class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors flex justify-between items-center" @click="selectDay(day.value)">
                                {{ day.label }}
                                <span v-if="selectedDay === day.value" class="text-primary text-xs font-bold">✓</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="relative w-full">
                    <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input v-model="searchQuery" placeholder="Search Subject" class="pl-10 bg-white rounded-full border-none shadow-sm" />
                </div>
            </div>

            <div class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
                <div 
                    class="flex items-center gap-1 w-1/2 cursor-pointer transition-colors hover:text-primary"
                    :class="sortBy === 'subject' ? 'text-primary' : ''"
                    @click="sortBy = 'subject'"
                >
                    Subject 
                    <ArrowUpDown class="w-3 h-3" />
                </div>
                <div 
                    class="flex items-center justify-end gap-1 w-1/2 cursor-pointer transition-colors hover:text-primary"
                    :class="sortBy === 'time' ? 'text-primary' : ''"
                    @click="sortBy = 'time'"
                >
                    <span>Day & Time</span>
                    <ArrowUpDown class="w-3 h-3" />
                </div>
            </div>

            <div class="space-y-1">
                <div v-for="(item, index) in filteredTimetable" :key="index" 
                     class="flex items-center justify-between py-4 border-b border-gray-100 hover:bg-gray-50 px-2 transition-colors">
                    
                    <div class="w-1/2 pr-4">
                        <p class="text-sm font-bold text-gray-800">{{ item.nama_subjek }}</p>
                        <p class="text-xs text-gray-500 uppercase mt-1">
                            {{ item.kod_subjek }} - Sec {{ item.seksyen }}
                        </p>
                    </div>

                    <div class="w-auto text-xs text-gray-500 flex flex-col items-end mr-4">
                        <span class="font-semibold text-primary uppercase">{{ formatDay(item.hari) }}</span>
                        <span class="text-[10px] md:text-xs font-mono">
                            {{ formatSingleBlock(item.masa) }}
                        </span>
                    </div>

                    <div class="pl-2">
                        <button @click="viewDetails(item)" class="text-gray-400 hover:text-primary transition-colors">
                            <Eye class="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                <div v-if="filteredTimetable.length === 0" class="text-center py-10 text-gray-400 flex flex-col items-center">
                    <p>No classes found.</p>
                    <p v-if="selectedDay" class="text-xs mt-1">Try clearing the "{{ formatDay(selectedDay) }}" filter.</p>
                </div>
            </div>
        </div>

        <div v-else>
            <button @click="goBack" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" />
                Back
            </button>

            <Card class="w-full shadow-md border border-gray-100">
                <CardContent class="p-6 space-y-8 relative">
                    
                    <div>
                        <h2 class="text-xl font-bold text-primary mb-1 uppercase">
                            {{ selectedItem.nama_subjek }}
                        </h2>
                        <p class="text-sm text-gray-500">
                            {{ selectedItem.kod_subjek }}
                        </p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-4">
                        <div>
                            <p class="text-xs text-gray-400 font-medium mb-1">Schedule</p>
                            <p class="text-sm font-medium text-gray-800">
                                {{ formatDay(selectedItem.hari) }}, {{ formatSingleBlock(selectedItem.masa) }}
                            </p>
                        </div>

                        <div>
                            <p class="text-xs text-gray-400 font-medium mb-1">Location</p>
                            <div v-if="selectedItem.ruang">
                                <p class="text-sm font-bold text-gray-800">{{ selectedItem.ruang.kod_ruang }}</p> 
                                <p class="text-xs text-gray-500 uppercase">{{ selectedItem.ruang.nama_ruang }}</p>
                            </div>
                            <div v-else>
                                <p class="text-sm font-medium text-gray-800">Online / TBA</p>
                            </div>
                        </div>

                        <div>
                            <p class="text-xs text-gray-400 font-medium mb-1">Lecturer</p>
                            <div class="flex items-center gap-2">
                                <div class="bg-gray-100 p-1 rounded-full">
                                    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <p class="text-sm font-medium text-gray-800 uppercase">
                                    {{ selectedItem.lecturer_name }}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p class="text-xs text-gray-400 font-medium mb-1">Section</p>
                            <p class="text-sm font-medium text-gray-800">{{ selectedItem.seksyen }}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

    </div>
</template>