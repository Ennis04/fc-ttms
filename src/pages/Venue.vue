<script setup>
import { ref, onMounted, computed, watch } from "vue";
import {
    Search, Eye, ArrowLeft, Loader2, MapPin, ChevronLeft, ChevronRight, X, Calendar, Clock
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { useUserStore } from "@/stores/user";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import Label from "@/components/ui/label/Label.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import{readSessionJSON, writeSessionJSON, removeSession} from "@/stores/sessionStorage";

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

// --- AVAILABILITY MODAL STATE ---
const showAvailabilityModal = ref(false);
const checkDay = ref("");
const checkTime = ref("");
const availableVenues = ref([]);
const isChecking = ref(false);

// CACHE SETTINGS
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

const userKey = computed(() => localStorage.getItem("matric_no") || "unknown");
const cacheBase = computed(() => `ttms:venue:${userKey.value}`);

const keyVenueList = computed(() => `${cacheBase.value}:list`);
const keyVenueSchedule = computed(() => {
  const code = selectedVenue.value?.kod_ruang || "none";
  return `${cacheBase.value}:schedule:${currentSesi.value}:${currentSem.value}:${code}`;
});

const isFresh = (savedAt) => {
  if (!CACHE_MAX_AGE_MS) return true;
  if (typeof savedAt !== "number") return false;
  return Date.now() - savedAt <= CACHE_MAX_AGE_MS;
};

const restoreVenueListCache = () => {
  const cached = readSessionJSON(keyVenueList.value, null);
  if (!cached || !isFresh(cached.savedAt)) return false;

  if (Array.isArray(cached.venues)) venueList.value = cached.venues;
  return venueList.value.length > 0;
};

const saveVenueListCache = () => {
  writeSessionJSON(keyVenueList.value, {
    savedAt: Date.now(),
    venues: venueList.value,
  });
};

const restoreVenueScheduleCache = () => {
  const cached = readSessionJSON(keyVenueSchedule.value, null);
  if (!cached || !isFresh(cached.savedAt)) return false;

  if (cached.venue) selectedVenue.value = cached.venue;
  if (Array.isArray(cached.schedule)) venueSchedule.value = cached.schedule;
  return true;
};

const saveVenueScheduleCache = () => {
  writeSessionJSON(keyVenueSchedule.value, {
    savedAt: Date.now(),
    venue: selectedVenue.value,
    schedule: venueSchedule.value,
  });
};

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

    const restored = restoreVenueListCache();
    if (!restored) {
        await fetchVenues();
    }
    loading.value = false;

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
    
    if (!currentSesi.value || !currentSem.value) {
        const year = new Date().getFullYear();
        currentSesi.value = `${year}/${year + 1}`;
        currentSem.value = 1;
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

        saveVenueListCache();
    } catch (err) {
        error.value = "Failed to load venues.";
    }
};

const openVenueDetail = async (venue) => {
    error.value = "";
    selectedVenue.value = venue;
    venueSchedule.value = [];

    if (restoreVenueScheduleCache()) {
        currentView.value = 2;
        return;
    }

    loading.value = true;
    try {
        const response = await axios.get("http://web.fc.utm.my/ttms/web_man_webservice_json.cgi", {
        params: {
            entity: "jadual_ruang",
            sesi: currentSesi.value,
            semester: currentSem.value,
            kod_ruang: venue.kod_ruang,
            limit: 2000,
        },
        });

        venueSchedule.value = response.data || [];
        saveVenueScheduleCache();
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

const checkAvailability = async () => {

    if (!checkDay.value || !checkTime.value) return;

    isChecking.value = true;
    availableVenues.value = []; 

    try {
        const hour = parseInt(checkTime.value.split(':')[0]);
        const targetMasa = hour - 6;

        const venuesToCheck = venueList.value;

        const checks = venuesToCheck.map(async (venue) => {
            try {
                const response = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
                    params: {
                        entity: 'jadual_ruang',
                        sesi: currentSesi.value,
                        semester: currentSem.value,
                        kod_ruang: venue.kod_ruang
                    }
                });

                const schedule = response.data || [];

                const isOccupied = schedule.some(slot =>
                    parseInt(slot.hari) === parseInt(checkDay.value) &&
                    parseInt(slot.masa) === targetMasa
                );

                if (!isOccupied) {
                    return venue;
                }
                return null;

            } catch (err) {
                return null; 
            }
        });

        const results = await Promise.all(checks);
        availableVenues.value = results.filter(v => v !== null);

    } catch (err) {
        console.error("Availability check failed:", err);
    } finally {
        isChecking.value = false;
    }
}

onMounted(() => {
    initPage();
});
</script>

<template>
    <div class="p-4 md:p-6 w-full min-h-screen">
        <div v-if="showAvailabilityModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card class="w-full max-w-lg bg-white shadow-xl relative animate-in fade-in zoom-in duration-200">
                <button @click="showAvailabilityModal = false"
                    class="absolute right-4 top-4 text-gray-400 hover:text-red-500">
                    <X class="w-5 h-5" />
                </button>

                <CardHeader>
                    <CardTitle>Check Room Availability</CardTitle>
                </CardHeader>

                <CardContent class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <Label>Day</Label>
                            <Select v-model="checkDay">
                                <SelectTrigger class="w-full pl-8 relative">
                                    <Calendar class="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                    <SelectValue placeholder="Select Day" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Sunday</SelectItem>
                                    <SelectItem value="2">Monday</SelectItem>
                                    <SelectItem value="3">Tuesday</SelectItem>
                                    <SelectItem value="4">Wednesday</SelectItem>
                                    <SelectItem value="5">Thursday</SelectItem>
                                    <SelectItem value="6">Friday</SelectItem>
                                    <SelectItem value="7">Saturday</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div class="space-y-2">
                            <Label>Time</Label>
                            <div class="relative">
                                <Clock class="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
                                <Input v-model="checkTime" type="time" class="pl-8" />
                            </div>
                        </div>
                    </div>

                    <Button @click="checkAvailability" class="w-full bg-primary"
                        :disabled="!checkDay || !checkTime || isChecking">
                        <Loader2 v-if="isChecking" class="w-4 h-4 mr-2 animate-spin" />
                        {{ isChecking ? 'Checking...' : 'Find Available Rooms' }}
                    </Button>

                    <div v-if="availableVenues.length > 0 && !isChecking"
                        class="mt-4 max-h-[200px] overflow-y-auto space-y-2 border-t pt-2">
                        <p class="text-xs text-gray-500 font-bold mb-2">Available Rooms:</p>
                        <div v-for="(v, i) in availableVenues" :key="i"
                            class="flex justify-between items-center bg-gray-50 p-3 rounded border">
                            <div>
                                <p class="text-sm font-bold">{{ v.nama_ruang }}</p>
                                <p class="text-xs text-gray-500 font-mono">
                                    {{ v.kod_ruang }} <span class="text-gray-300 mx-1">|</span> {{ v.jenis }}
                                    <span class="text-gray-300 mx-1">|</span> Cap: {{ v.kapasiti }}
                                </p>
                            </div>
                            <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Available</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div v-if="loading" class="flex justify-center h-64 items-center">
            <Loader2 class="w-8 h-8 animate-spin text-primary" />
        </div>
        <div v-else-if="error" class="bg-red-100 text-red-600 p-4 rounded mb-4">{{ error }}</div>

        <div v-else-if="currentView === 1">
            <div class="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-bold text-primary">Space</h1>
                    <p class="text-gray-500 text-sm">Faculty Rooms & Labs ({{ currentSesi }})</p>
                </div>

                <Button @click="showAvailabilityModal = true"
                    class="bg-primary text-white shadow hover:bg-red-900 transition-all">
                    Check Availability
                </Button>
            </div>

            <div class="relative w-full mb-6">
                <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input v-model="searchQuery" placeholder="Search Space Name or Code"
                    class="pl-10 bg-white rounded-full shadow-sm" />
            </div>

            <div
                class="flex items-center justify-between text-gray-500 text-xs uppercase font-semibold border-b pb-2 mb-2 px-2">
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
                        <span class="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{{ venue.kapasiti
                            }}</span>
                        <button @click="openVenueDetail(venue)" class="text-gray-400 hover:text-primary">
                            <Eye class="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="filteredVenues.length > itemsPerPage"
                class="flex justify-between items-center mt-6 border-t pt-4">
                <Button variant="outline" size="sm" @click="prevPage" :disabled="currentPage === 1"
                    class="flex gap-1 items-center">
                    <ChevronLeft class="w-4 h-4" /> Prev
                </Button>
                <span class="text-xs text-gray-500 font-medium">Page {{ currentPage }} of {{ totalPages }}</span>
                <Button variant="outline" size="sm" @click="nextPage" :disabled="currentPage === totalPages"
                    class="flex gap-1 items-center">
                    Next
                    <ChevronRight class="w-4 h-4" />
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
                            <p class="text-sm font-bold text-gray-800">{{ selectedVenue.kod_fakulti || '-' }}/{{
                                selectedVenue.kod_jabatan || '-' }}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Type</p>
                            <p class="text-sm font-bold text-gray-800 uppercase">{{ selectedVenue.jenis || 'General' }}
                            </p>
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

                <div v-if="dailySchedule.length === 0"
                    class="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p class="text-gray-400 text-sm">No classes scheduled for {{ formatDay(selectedDay) }}.</p>
                </div>
            </div>
        </div>

    </div>
</template>