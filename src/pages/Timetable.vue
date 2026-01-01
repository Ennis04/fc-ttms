<script setup>
import { ref, onMounted, computed } from "vue";
import {
    Search, Eye, ArrowLeft, Loader2, X, ChevronDown, ChevronUp, Clock
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios"; 
import { useUserStore } from "@/stores/user";
import { readSessionJSON, writeSessionJSON, removeSession } from "@/stores/sessionStorage";

// --- STATE MANAGEMENT ---
const userStore = useUserStore();
const selectedItem = ref(null);
const searchQuery = ref("");
const loading = ref(false);
const error = ref("");
const timetableData = ref([]);
const currentSesi = ref("");
const currentSem = ref("");
const expandedDays = ref({ 2: true }); // Default Monday open

// --- MAPPING ---
const availableDays = [
    { value: 2, label: "Monday", color: "bg-red-50 border-red-100", badge: "bg-red-200 text-red-800" },
    { value: 3, label: "Tuesday", color: "bg-orange-50 border-orange-100", badge: "bg-orange-200 text-orange-800" },
    { value: 4, label: "Wednesday", color: "bg-green-50 border-green-100", badge: "bg-green-200 text-green-800" },
    { value: 5, label: "Thursday", color: "bg-blue-50 border-blue-100", badge: "bg-blue-200 text-blue-800" },
    { value: 6, label: "Friday", color: "bg-purple-50 border-purple-100", badge: "bg-purple-200 text-purple-800" }, 
];

// --- CACHE LOGIC (From Code 1) ---
const cacheKeyBase = computed(() => {
    const id = localStorage.getItem("matric_no") || "unknown";
    return `ttms:timetable:${id}`;
});
const cacheKeyData = computed(() => `${cacheKeyBase.value}:data`);
const cacheKeyMeta = computed(() => `${cacheKeyBase.value}:meta`);
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; 

const restoreFromCache = () => {
    const cachedData = readSessionJSON(cacheKeyData.value, []);
    const cachedMeta = readSessionJSON(cacheKeyMeta.value, null);
    if (!cachedMeta || cachedData.length === 0) return false;
    if (Date.now() - cachedMeta.savedAt > CACHE_MAX_AGE_MS) return false;

    timetableData.value = cachedData;
    currentSesi.value = cachedMeta.sesi || "";
    currentSem.value = cachedMeta.sem || "";
    return true;
};

const saveToCache = () => {
    writeSessionJSON(cacheKeyData.value, timetableData.value);
    writeSessionJSON(cacheKeyMeta.value, {
        sesi: currentSesi.value,
        sem: currentSem.value,
        savedAt: Date.now(),
    });
};

// --- COMPUTED ---
const filteredTimetable = computed(() => {
    if (!searchQuery.value) return timetableData.value;
    const query = searchQuery.value.toLowerCase();
    return timetableData.value.filter(item => 
        item.nama_subjek.toLowerCase().includes(query) || 
        item.kod_subjek.toLowerCase().includes(query)
    );
});

// --- HELPERS ---
const toggleDay = (dayValue) => expandedDays.value[dayValue] = !expandedDays.value[dayValue];
const getClassesForDay = (dayValue) => filteredTimetable.value.filter(item => item.hari == dayValue);
const formatDay = (day) => {
    const days = { 1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday" };
    return days[day] || day;
};
const formatTime = (startMasa, endMasa) => {
    const end = endMasa || startMasa; 
    const startHour = parseInt(startMasa) + 6; 
    const endHour = parseInt(end) + 6; 
    const pad = (n) => n < 10 ? '0' + n : n;
    return `${pad(startHour)}00 - ${pad(endHour)}50`;
};

// --- API ACTIONS ---
const fetchTimetable = async () => {
    loading.value = true;
    error.value = "";
    const matricNo = localStorage.getItem('matric_no');

    try {
        let allSubjects = [];
        // Attempt Student API
        try {
            const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                params: { entity: 'pelajar_subjek', no_matrik: matricNo }
            });
            if (Array.isArray(res.data) && res.data.length > 0) allSubjects = res.data;
            console.log("STUDENT SUBJECTS FROM TIMETABLE: ",allSubjects)
            if(allSubjects.length){
                currentSem.value=allSubjects[0].semester
                currentSesi.value=allSubjects[0].sesi
                console.log("filtering allSubjects, current sesi and current sem is: ",currentSem.value,currentSesi.value)
                allSubjects=allSubjects.filter((subject)=>subject.sesi === currentSesi.value && subject.semester === currentSem.value)
            }
        } catch (e) { console.error("Student API fail", e); }

        // Attempt Lecturer API if student fails
        if (allSubjects.length === 0) {
            try {
                const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                    params: { entity: 'pensyarah_subjek', no_pekerja: matricNo }
                });
                if (Array.isArray(res.data) && res.data.length > 0) allSubjects = res.data;
            } catch (e) { console.error("Lecturer API fail", e); }
        }

        if (allSubjects.length === 0) {
            error.value = "No subjects found for this semester.";
            return;
        }

        currentSesi.value = allSubjects[0].sesi;
        currentSem.value = allSubjects[0].semester;

        // Fetch details for each subject
        const detailedRequests = allSubjects.map(async (subject) => {
            const [schRes, lecRes] = await Promise.allSettled([
                axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                    params: { entity: 'jadual_subjek', sesi: currentSesi.value, semester: currentSem.value, kod_subjek: subject.kod_subjek, seksyen: subject.seksyen }
                }),
                axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                    params: { entity: 'subjek_pensyarah', sesi: currentSesi.value, semester: currentSem.value, kod_subjek: subject.kod_subjek, seksyen: subject.seksyen }
                })
            ]);

            let lecturerName = "Not Assigned";
            if (lecRes.status === 'fulfilled' && lecRes.value.data?.[0]) {
                const l = lecRes.value.data[0];
                lecturerName = l.nama || l.nama_pensyarah || "Unknown";
            }

            const rawSchedules = schRes.status === 'fulfilled' && Array.isArray(schRes.value.data) ? schRes.value.data : [];
            const schedules = rawSchedules.filter(s => s?.masa);

            if (schedules.length === 0) {
                return [{ ...subject, hari: "TBA", masa: 0, lecturer_name: lecturerName }];
            }

            return schedules.map(slot => ({ ...subject, ...slot, masa: parseInt(slot.masa), lecturer_name: lecturerName }));
        });

        const nestedResults = await Promise.all(detailedRequests);
        const sortedData = nestedResults.flat().sort((a, b) => (a.hari != b.hari) ? a.hari - b.hari : a.masa - b.masa);

        // --- TIME MERGING LOGIC ---
        const mergedData = [];
        if (sortedData.length > 0) {
            let currentBlock = { ...sortedData[0], endMasa: sortedData[0].masa };
            for (let i = 1; i < sortedData.length; i++) {
                const nextSlot = sortedData[i];
                const isConsecutive = nextSlot.hari == currentBlock.hari && 
                                     nextSlot.kod_subjek == currentBlock.kod_subjek && 
                                     parseInt(nextSlot.masa) === parseInt(currentBlock.endMasa) + 1;

                if (isConsecutive) {
                    currentBlock.endMasa = nextSlot.masa;
                } else {
                    mergedData.push(currentBlock);
                    currentBlock = { ...nextSlot, endMasa: nextSlot.masa };
                }
            }
            mergedData.push(currentBlock);
        }

        timetableData.value = mergedData;
        saveToCache();
    } catch (err) {
        error.value = "Failed to load timetable.";
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    if (!restoreFromCache()) fetchTimetable();
});
</script>

<template>
    <div class="p-4 md:p-6 w-full min-h-screen bg-white">
        <div v-if="loading" class="flex flex-col items-center justify-center h-64 text-gray-500">
            <Loader2 class="w-8 h-8 animate-spin mb-2 text-primary" />
            <p>Loading session data...</p>
        </div>

        <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-md border border-red-200 text-center">
            {{ error }}
            <Button variant="outline" class="mt-2 block mx-auto" @click="fetchTimetable">Retry</Button>
        </div>

        <div v-else-if="!selectedItem">
            <div class="mb-6">
                <h1 class="text-2xl font-bold text-primary">My Timetable</h1>
                <p class="text-gray-500 text-sm">Session {{ currentSesi }} | Sem {{ currentSem }}</p>
            </div>

            <div class="bg-purple-50/50 p-4 rounded-lg mb-6 flex items-center shadow-sm">
                <div class="relative w-full">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input v-model="searchQuery" placeholder="Search code or subject..." class="pl-10 bg-white rounded-full border-none" />
                </div>
            </div>

            <div class="space-y-3">
                <div v-for="day in availableDays" :key="day.value" class="border rounded-lg overflow-hidden bg-white shadow-sm">
                    <div @click="toggleDay(day.value)" 
                         class="p-4 flex justify-between items-center cursor-pointer hover:opacity-90 transition-all"
                         :class="[day.color, expandedDays[day.value] ? 'border-b' : '']">
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-0.5 rounded text-xs font-bold" :class="day.badge">
                                {{ getClassesForDay(day.value).length }}
                            </span>
                            <span class="font-bold uppercase tracking-wide text-gray-800">{{ day.label }}</span>
                        </div>
                        <ChevronUp v-if="expandedDays[day.value]" class="w-5 h-5" />
                        <ChevronDown v-else class="w-5 h-5" />
                    </div>

                    <div v-if="expandedDays[day.value]" class="divide-y divide-gray-50">
                        <div v-for="(item, i) in getClassesForDay(day.value)" :key="i" 
                             class="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors pl-6 md:pl-10">
                            <div class="w-2/3">
                                <p class="text-sm font-bold text-gray-800 leading-tight">{{ item.nama_subjek }}</p>
                                <p class="text-[11px] text-gray-500 uppercase mt-1">
                                    {{ item.kod_subjek }} • Section {{ item.seksyen }}
                                </p>
                            </div>
                            <div class="flex items-center gap-4">
                                <div class="text-right">
                                    <p class="text-[10px] font-mono font-bold text-primary">{{ formatTime(item.masa, item.endMasa) }}</p>
                                </div>
                                <button @click="selectedItem = item" class="text-gray-400 hover:text-primary transition-colors">
                                    <Eye class="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div v-if="getClassesForDay(day.value).length === 0" class="p-6 text-center text-gray-400 text-xs italic">
                            No classes scheduled.
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else>
            <button @click="selectedItem = null" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" /> Back to Schedule
            </button>
            <Card class="shadow-lg border-none bg-gradient-to-br from-white to-gray-50">
                <CardContent class="p-6 space-y-6">
                    <div>
                        <h2 class="text-xl font-bold text-primary uppercase">{{ selectedItem.nama_subjek }}</h2>
                        <p class="text-gray-500">{{ selectedItem.kod_subjek }} | Section {{ selectedItem.seksyen }}</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="flex items-start gap-3">
                            <Clock class="w-5 h-5 text-gray-400 mt-1" />
                            <div>
                                <p class="text-xs text-gray-400 font-medium">Time</p>
                                <p class="text-sm font-bold">{{ formatDay(selectedItem.hari) }}, {{ formatTime(selectedItem.masa, selectedItem.endMasa) }}</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-5 h-5 text-gray-400 mt-1">📍</div>
                            <div>
                                <p class="text-xs text-gray-400 font-medium">Location</p>
                                <p class="text-sm font-bold">{{ selectedItem.ruang?.nama_ruang || 'Online / TBA' }}</p>
                                <p class="text-[10px] text-gray-500">{{ selectedItem.ruang?.kod_ruang }}</p>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <div class="w-5 h-5 text-gray-400 mt-1">👤</div>
                            <div>
                                <p class="text-xs text-gray-400 font-medium">Lecturer</p>
                                <p class="text-sm font-bold uppercase">{{ selectedItem.lecturer_name }}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>