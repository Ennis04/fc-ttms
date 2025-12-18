<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { 
    Search, Eye, ArrowLeft, Loader2, MapPin, ChevronLeft, ChevronRight 
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios"; 
import { useUserStore } from "@/stores/user";

// --- STATE MANAGEMENT ---
const userStore = useUserStore();
const currentView = ref(1); 
const loading = ref(false);
const error = ref("");
const searchQuery = ref("");

// SESSION STATE 
const currentSesi = ref(""); 
const currentSem = ref("");

// PAGINATION
const currentPage = ref(1);
const itemsPerPage = 10;

// Data Containers
const venueList = ref([]);       
const selectedVenue = ref(null); 
const venueSchedule = ref([]);   
const selectedDay = ref(2);      

// --- COMPUTED PROPERTIES ---

// 1. Search & Pagination
const filteredVenues = computed(() => {
    if (!searchQuery.value) return venueList.value;
    const query = searchQuery.value.toLowerCase();
    return venueList.value.filter(v => 
        v.nama_ruang.toLowerCase().includes(query) || 
        v.kod_ruang.toLowerCase().includes(query)
    );
});

const totalPages = computed(() => Math.ceil(filteredVenues.value.length / itemsPerPage));

const paginatedVenues = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredVenues.value.slice(start, end);
});

// 2. Statistics for Level 2 (STRICTER COUNTING)
const venueStats = computed(() => {
    const schedule = venueSchedule.value || [];
    
    // Filter out "ghost" slots - ensure they have a Day and Time
    const validSlots = schedule.filter(s => s.hari && s.masa);
    
    const totalHours = validSlots.length;

    const uniqueSubjects = new Set(
        validSlots
        .map(s => s.subjek ? s.subjek.kod_subjek : null)
        .filter(code => code && code !== "")
    );
    
    return {
        hours: totalHours,
        subjects: uniqueSubjects.size
    };
});

// 3. Daily Schedule for Level 3
const dailySchedule = computed(() => {
    const filtered = venueSchedule.value.filter(s => s.hari == selectedDay.value);
    return filtered.sort((a, b) => parseInt(a.masa) - parseInt(b.masa));
});

watch(searchQuery, () => {
    currentPage.value = 1;
});

// --- HELPERS ---
const formatDay = (day) => {
    const days = { 1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday", 5: "Thursday", 6: "Friday", 7: "Saturday" };
    return days[day] || "Day " + day;
}

const formatTime = (apiMasa) => {
    const startHour = parseInt(apiMasa) + 6; 
    const pad = (n) => n < 10 ? '0' + n : n;
    return `${pad(startHour)}00 - ${pad(startHour)}50`;
}

// --- API ACTIONS ---

const initPage = async () => {
    loading.value = true;
    console.log("matric no in store:", userStore.matric_no)
    if (userStore.matric_no) {
        try {
            const historyRes = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                params: { entity: 'pelajar_subjek', no_matrik: userStore.matric_no }
            });
            if (historyRes.data && historyRes.data.length > 0) {
                currentSesi.value = historyRes.data[0].sesi;
                currentSem.value = historyRes.data[0].semester;
            }
        } catch (e) {
            // Silent fail if session detect errors
        }
    }

    await fetchVenues();
    loading.value = false;
}

const fetchVenues = async () => {
    try {
        const response = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: { entity: 'ruang' }
        });
        
        venueList.value = response.data || [];
        venueList.value.sort((a, b) => a.nama_ruang.localeCompare(b.nama_ruang));

    } catch (err) {
        error.value = "Failed to load venues.";
    }
};

const openVenueDetail = async (venue) => {
    loading.value = true;
    selectedVenue.value = venue;
    venueSchedule.value = []; 

    try {
        const response = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: {
                entity: 'jadual_ruang',
                sesi: currentSesi.value,    
                semester: currentSem.value, 
                kod_ruang: venue.kod_ruang,
                limit: 2000 
            }
        });

        venueSchedule.value = response.data || [];
        currentView.value = 2;
    } catch (err) {
        error.value = "Failed to load venue schedule.";
    } finally {
        loading.value = false;
    }
};

const openTimetable = () => {
    selectedDay.value = 2; 
    currentView.value = 3;
}

const changeDay = (direction) => {
    let newDay = selectedDay.value + direction;
    if (newDay > 6) newDay = 1; 
    if (newDay < 1) newDay = 6; 
    selectedDay.value = newDay;
}

const goBack = () => {
    if (currentView.value === 3) currentView.value = 2;
    else if (currentView.value === 2) currentView.value = 1;
};

const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; }
const prevPage = () => { if (currentPage.value > 1) currentPage.value--; }

onMounted(() => {
    initPage();
});
</script>

<template>
    <div class="p-4 md:p-6 w-full min-h-screen">
        
        <div v-if="loading" class="flex justify-center h-64 items-center">
            <Loader2 class="w-8 h-8 animate-spin text-primary"/>
        </div>
        <div v-else-if="error" class="bg-red-100 text-red-600 p-4 rounded mb-4">{{ error }}</div>

        <div v-else-if="currentView === 1">
            <div class="mb-6">
                 <h1 class="text-2xl font-bold text-primary">Space</h1>
                 <p class="text-gray-500 text-sm">Faculty Rooms & Labs ({{ currentSesi }})</p>
            </div>

            <div class="relative w-full mb-6">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input v-model="searchQuery" placeholder="Search Space Name or Code" class="pl-10 bg-white rounded-full shadow-sm" />
            </div>

            <div class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
                <span>Space Name</span>
                <span class="pr-8">Capacity</span>
            </div>

            <div class="space-y-1 min-h-[400px]">
                <div v-for="(venue, i) in paginatedVenues" :key="i" 
                     class="flex items-center justify-between py-4 border-b border-gray-100 hover:bg-gray-50 px-2 transition-colors">
                    <div class="w-2/3 pr-4">
                        <p class="text-sm font-bold text-gray-800 uppercase">{{ venue.nama_ruang }}</p>
                        <p class="text-xs text-gray-400 font-mono mt-1">{{ venue.kod_ruang }}</p>
                    </div>
                    <div class="w-1/3 flex items-center justify-between">
                        <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{{ venue.kapasiti }}</span>
                        <button @click="openVenueDetail(venue)" class="text-gray-400 hover:text-primary">
                            <Eye class="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="filteredVenues.length > itemsPerPage" class="flex justify-between items-center mt-6 border-t pt-4">
                <Button variant="outline" size="sm" @click="prevPage" :disabled="currentPage === 1" class="flex gap-1 items-center">
                    <ChevronLeft class="w-4 h-4"/> Prev
                </Button>
                <span class="text-xs text-gray-500 font-medium">Page {{ currentPage }} of {{ totalPages }}</span>
                <Button variant="outline" size="sm" @click="nextPage" :disabled="currentPage === totalPages" class="flex gap-1 items-center">
                    Next <ChevronRight class="w-4 h-4"/>
                </Button>
            </div>
        </div>

        <div v-else-if="currentView === 2">
            <button @click="goBack" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" /> Back to Spaces
            </button>

            <div class="mb-6">
                <h2 class="text-xl font-bold text-gray-800 uppercase mb-1">{{ selectedVenue.nama_ruang }}</h2>
                <div class="flex gap-2 text-xs text-gray-500">
                    <span>space > {{ selectedVenue.nama_ruang_singkatan || '...' }}</span>
                </div>
            </div>

            <Card class="w-full shadow-md border border-gray-100 mb-6 bg-white">
                <CardContent class="p-6">
                    <div class="grid grid-cols-2 gap-y-6 gap-x-4">
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Space Code</p>
                            <p class="text-sm font-bold text-gray-800">{{ selectedVenue.kod_ruang }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Faculty/Department</p>
                            <p class="text-sm font-bold text-gray-800">{{ selectedVenue.kod_fakulti || '-' }}/{{ selectedVenue.kod_jabatan || '-' }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Type</p>
                            <p class="text-sm font-bold text-gray-800 uppercase">{{ selectedVenue.jenis || 'General' }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Capacity</p>
                            <p class="text-sm font-bold text-gray-800">{{ selectedVenue.kapasiti }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Total Usage Time/Week</p>
                            <p class="text-sm font-bold text-gray-800">{{ venueStats.hours }} Hours</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Total Subject</p>
                            <p class="text-sm font-bold text-gray-800">{{ venueStats.subjects }}</p>
                        </div>
                    </div>

                    <div class="mt-8 flex justify-center">
                        <Button class="bg-primary text-white px-8 py-2 hover:bg-red-900" @click="openTimetable">
                            View Timetable
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div v-else-if="currentView === 3">
            <button @click="goBack" class="flex items-center gap-2 text-primary font-medium mb-6 hover:underline">
                <ArrowLeft class="w-5 h-5" /> Back to Detail
            </button>

            <Card class="mb-4 border-none shadow-sm">
                <CardContent class="p-2 flex items-center justify-between">
                    <Button variant="ghost" size="icon" @click="changeDay(-1)">
                        <ChevronLeft class="w-5 h-5 text-gray-600" />
                    </Button>
                    <h2 class="text-lg font-bold text-gray-800">{{ formatDay(selectedDay) }}</h2>
                    <Button variant="ghost" size="icon" @click="changeDay(1)">
                        <ChevronRight class="w-5 h-5 text-gray-600" />
                    </Button>
                </CardContent>
            </Card>

            <div class="space-y-2">
                <div v-for="(slot, i) in dailySchedule" :key="i" 
                     class="flex bg-white border-l-4 border-primary shadow-sm p-4 rounded-r-md">
                    
                    <div class="w-24 border-r border-gray-100 pr-4 mr-4 flex flex-col justify-center">
                        <span class="text-xs font-bold text-gray-800">{{ formatTime(slot.masa) }}</span>
                        <span class="text-[10px] text-gray-400">Duration: 1h</span>
                    </div>

                    <div>
                        <p class="text-sm font-bold text-primary uppercase">
                            {{ slot.subjek?.kod_subjek || slot.catatan || 'Reserved' }}
                        </p>
                        <p class="text-xs text-gray-600 mt-1">
                            <span v-if="slot.subjek?.seksyen">Section {{ slot.subjek.seksyen }}</span>
                            <span v-else>Event</span>
                        </p>
                        <div class="flex items-center gap-1 mt-2 text-xs text-gray-400">
                            <MapPin class="w-3 h-3" />
                            {{ selectedVenue.nama_ruang_singkatan }}
                        </div>
                    </div>
                </div>

                <div v-if="dailySchedule.length === 0" class="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p class="text-gray-400 text-sm">No classes scheduled for {{ formatDay(selectedDay) }}.</p>
                </div>
            </div>
        </div>

    </div>
</template>