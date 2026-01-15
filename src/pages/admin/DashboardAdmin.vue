<script setup>
import getStudents from '@/api/api'
import axios from 'axios'
import { Loader2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

/* =========================
   STATE
========================= */
const loading = ref(true)
const error = ref(null)
const savedStats = JSON.parse(localStorage.getItem('admin_statistic') || '{}');
const stats = ref({
  students: savedStats?.students || 0,
  courses: savedStats?.courses || 0,
  lecturers: savedStats?.lecturers || 0,
  venue: savedStats?.venue || 0,
})
console.log("admin statistic: ",localStorage.getItem('admin_statistic'))
const lecturerOverwork = ref([])
const venueTimeTable = ref([])

const venueRes = ref({})
const sessionId = localStorage.getItem('session_id_utm_ttms')
const adminId = localStorage.getItem('admin_id_utm_ttms') || ''
/* =========================
   PAGINATION
========================= */
const ITEMS_PER_PAGE = 5
const currentPage = ref(1)

/* =========================
   HELPER: FIND OVERLAPS
========================= */
function findVenueOverlaps(timetable = []) {
  const map = {}

  timetable.forEach(item => {
    if (!item?.tarikh_mula || item?.masa == null || item?.hari == null) return

    const key = `${item.tarikh_mula}_${item.masa}_${item.hari}`
    map[key] ??= []

    // CHECK FOR DUPLICATES: 
    // Only push if no item in the current group shares the same kod_perkara 
    // OR same kod_subjek + seksyen
    const isDuplicate = map[key].some(existing => {
      const samePerkara = item.kod_perkara && existing.kod_perkara === item.kod_perkara;
      
      const sameSubjekSeksyen = 
        item.subjek?.kod_subjek === existing.subjek?.kod_subjek && 
        item.subjek?.seksyen === existing.subjek?.seksyen;

      return samePerkara || sameSubjekSeksyen;
    });

    if (!isDuplicate) {
      map[key].push(item);
    }
  })

  // Return only groups where more than one DISTINCT class is present
  return Object.values(map).filter(group => group.length > 1)
}

/* =========================
   COMPUTED: VENUE CONFLICTS
========================= */
const venueConflicts = computed(() => {
  return venueTimeTable.value
    .map(v => ({
      kod_ruang: v.kod_ruang,
      conflicts: findVenueOverlaps(v.timetable)
    }))
    .filter(v => v.conflicts.length > 0)
})

const flattenedConflicts = computed(() => {
  return venueConflicts.value
    .flatMap(venue => 
      (venue.conflicts || [])
        .filter(group => group && group.length > 0) 
        .map(group => ({
          kod_ruang: venue.kod_ruang,
          group
        }))
    )
})


/* =========================
   PAGINATED RESULT
========================= */
const totalPages = computed(() =>
  Math.ceil(flattenedConflicts.value.length / ITEMS_PER_PAGE)
)

const paginatedConflicts = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return flattenedConflicts.value.slice(start, start + ITEMS_PER_PAGE)
})

/* =========================
   MAIN FUNCTION
========================= */
const getStatistics = async () => {
  loading.value = true
  error.value = null
  venueTimeTable.value = JSON.parse(localStorage.getItem('venueTimeTable')) || []

  try {
    // 1. Fetch Basic Stats (only if missing)
    if (stats.value.students === 0) {
      console.log("loading students")
      const res = await getStudents('pelajar', sessionId, '2025/2026')
      stats.value.students = res.length // Update property, don't overwrite object
    }

    if (stats.value.lecturers === 0) {
      console.log("loading lecturers")
      const res = await getStudents('pensyarah', sessionId, '2025/2026', 0)
      stats.value.lecturers = res.length
    }

    if (stats.value.courses === 0) {
      console.log("loading courses")
      const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
        params: { entity: 'subjek', sesi: '2025/2026', semester: 1 }
      })
      stats.value.courses = res.data.length
    }

    if (stats.value.venue === 0) {
      console.log("loading venue")
      // 2. Fetch Venue List (Needed for the loop regardless of stats)
      venueRes.value = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
        params: { entity: 'ruang', kod_fakulti: 'FSKSM' }
      })
      stats.value.venue = venueRes.value.data.length
    }

    // 3. Handle Admin ID
    let currentAdminId = adminId
    if (currentAdminId === '') {
      console.log("loading admin")
      const admin = await axios.get('http://web.fc.utm.my/ttms/auth-admin.php', {
        params: { session_id: sessionId }
      })
      currentAdminId = admin.data?.[0]?.session_id
      localStorage.setItem('admin_id_utm_ttms',currentAdminId)
    }

    if (currentAdminId) {
      const lecturerData = await getStudents('pensyarah', currentAdminId, '2025/2026', 1)
      lecturerOverwork.value = lecturerData.filter(l => l.bil_seksyen > 5)
    }

    // 4. Fetch Venue Timetables (The loop)
    // Optimization: Use Promise.all if the API can handle it, otherwise keep the loop
    if(venueTimeTable.value.length === 0) {
      console.log("loading venueTimeTable")
        for (const v of venueRes.value.data) {
          console.log("loading venue timetable")
          const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: {
              entity: 'jadual_ruang',
              sesi: '2025/2026',
              semester: 1,
              kod_ruang: v.kod_ruang
            }
          })
    
          venueTimeTable.value.push({
            kod_ruang: v.kod_ruang,
            timetable: res.data || []
          })
        }
        // Saving venue timetable inside localStorage 
        localStorage.setItem('venueTimeTable',JSON.stringify(venueTimeTable.value))
    }

    // 5. Save to LocalStorage correctly
    localStorage.setItem('admin_statistic', JSON.stringify(stats.value))

  } catch (err) {
    console.error(err)
    error.value = 'Failed to load dashboard data'
  } finally {
    loading.value = false
  }
}

/* =========================
   LIFECYCLE
========================= */
onMounted(getStatistics)

/* =========================
   FORMATTERS
========================= */
const DAY_MAP_NUMERIC = {
  1: 'Sunday', 2: 'Monday', 3: 'Tuesday',
  4: 'Wednesday', 5: 'Thursday',
  6: 'Friday', 7: 'Saturday'
}

const TIME_MAP = {
  2: '8:00 AM', 3: '9:00 AM', 4: '10:00 AM',
  5: '11:00 AM', 6: '12:00 PM', 7: '1:00 PM',
  8: '2:00 PM', 9: '3:00 PM', 10: '4:00 PM',
  11: '5:00 PM'
}

const formatDay = hari => DAY_MAP_NUMERIC[hari] ?? 'Unknown Day'
const formatTime = masa => TIME_MAP[masa] ?? 'Unknown Time'


const timetable = {
  completed: 6,
  pending: 2,
  rescheduled: 5
}


const venues = [
  { name: "Lab A", usage: 92 },
  { name: "Lab B", usage: 65 },
  { name: "DKG 3", usage: 40 }
]
</script>

<template>
  <!-- LOADING STATE -->
  <div
    v-if="loading"
    class="min-h-screen flex flex-col items-center justify-center text-gray-600 space-y-4"
  >
    <Loader2 class="animate-spin size-10" />

    <p class="text-sm">Loading admin dashboard…</p>
  </div>

  <div v-else class="p-4 sm:p-8 space-y-6 font-sans">
    <h1 class="text-2xl font-bold">Faculty of Computing – Admin Dashboard</h1>
    <p class="text-gray-500 mb-6">2025/2026 Semester 1</p>

    <!-- KPI CARDS -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div class="bg-gray-100 rounded-xl p-4 text-center">
        <h3 class="text-gray-600">Total Courses</h3>
        <p class="text-3xl font-bold">{{ stats.courses }}</p>
      </div>

      <div class="bg-gray-100 rounded-xl p-4 text-center">
        <h3 class="text-gray-600">Total Lecturers</h3>
        <p class="text-3xl font-bold">{{ stats.lecturers }}</p>
      </div>

      <div class="bg-gray-100 rounded-xl p-4 text-center">
        <h3 class="text-gray-600">Total Students</h3>
        <p class="text-3xl font-bold">{{ stats.students }}</p>
      </div>

      <div class="bg-gray-100 rounded-xl p-4 text-center">
        <h3 class="text-gray-600">Total Venues</h3>
        <p class="text-3xl font-bold">{{ stats.venue }}</p>
      </div>

      <div class="bg-red-100 rounded-xl p-4 text-center">
        <h3 class="text-red-600">Venue Conflicts</h3>
        <p class="text-3xl font-bold text-red-600">
          {{ venueConflicts.length }}
        </p>
      </div>
    </div>

    <!-- TIMETABLE STATUS -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-3">Timetable Status</h2>
      <ul class="space-y-1 text-gray-700">
        <li>Completed Timetables: {{ timetable.completed }}</li>
        <li>Pending Timetables: {{ timetable.pending }}</li>
        <li>Rescheduled Classes: {{ timetable.rescheduled }}</li>
      </ul>
    </section>

    <!-- CONFLICT TABLE -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-3">Conflict Monitoring</h2>

      <table class="w-full border border-gray-200 rounded-lg">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-2 text-left">Venue</th>
            <th class="px-4 py-2 text-left">Start Date</th>
            <th class="px-4 py-2 text-left">Day</th>
            <th class="px-4 py-2 text-left">Time</th>
            <th class="px-4 py-2 text-left">Events</th>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(item, index) in paginatedConflicts" :key="item.kod_ruang + index" class="border-t">
            <td class="px-4 py-2 text-red-600 font-semibold">
              {{ item.kod_ruang }}
            </td>

            <td class="px-4 py-2">
              {{ item.group[0].tarikh_mula }}
            </td>

            <td class="px-4 py-2">
              {{ formatDay(item.group[0].hari) }}
            </td>

            <td class="px-4 py-2">
              {{ formatTime(item.group[0].masa) }}
            </td>

            <td class="px-4 py-2">
              <ul class="list-disc ml-4 text-sm">
                <li v-for="(e, i) in item.group" :key="i">
                  {{ e.kod_perkara || e.subjek?.kod_subjek }} - {{ e?.subjek?.seksyen || '' }}
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Pagination -->
      <div class="flex justify-between items-center mt-4">
        <button class="px-4 py-2 bg-gray-200 rounded disabled:opacity-50" :disabled="currentPage === 1"
          @click="currentPage--">
          Previous
        </button>

        <span class="text-sm">
          Page {{ currentPage }} of {{ totalPages }}
        </span>

        <button class="px-4 py-2 bg-gray-200 rounded disabled:opacity-50" :disabled="currentPage === totalPages"
          @click="currentPage++">
          Next
        </button>
      </div>

    </section>

    <!-- LECTURER WORKLOAD -->
    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-3">Lecturer Workload</h2>
      <table class="w-full border border-gray-200 rounded-lg">
        <thead class="bg-gray-100">
          <tr>
            <th class="px-4 py-2 text-left">Lecturer</th>
            <th class="px-4 py-2 text-left">Sections</th>
            <th class="px-4 py-2 text-left">Subjects</th>
            <th class="px-4 py-2 text-left">Students</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lecturer in lecturerOverwork" :key="lecturer.name" class="border-t">
            <td class="px-4 py-2 text-red-500">{{ lecturer.nama }}</td>
            <td class="px-4 py-2">{{ lecturer.bil_seksyen }}</td>
            <td class="px-4 py-2">{{ lecturer.bil_subjek }}</td>
            <td class="px-4 py-2">{{ lecturer.bil_pelajar }}</td>
            <!-- <td class="px-4 py-2 font-semibold" :class="lecturer.hours > 12 ? 'text-red-600' : 'text-green-600'">
              {{ lecturer.hours > 12 ? 'Overloaded' : 'Normal' }}
            </td> -->
          </tr>
        </tbody>
      </table>
    </section>

    <!-- VENUE UTILIZATION -->
    <section class="mb-10">
      <h2 class="text-xl font-semibold mb-3">Venue Utilization</h2>
      <ul class="space-y-2">
        <li v-for="venue in venues" :key="venue.name" class="flex justify-between bg-gray-50 p-3 rounded-lg">
          <span>{{ venue.name }}</span>
          <span class="font-semibold">{{ venue.usage }}%</span>
        </li>
      </ul>
    </section>

    <footer class="text-center text-gray-400 text-sm">
      🔒 Admin view only – editing disabled
    </footer>
  </div>
</template>
