<script setup>
import getStudents, { fetchStudents } from '@/api/api'
import axios from 'axios'
import { Loader2 } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { Bar, Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Filler } from 'chart.js'
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
console.log("admin statistic: ", localStorage.getItem('admin_statistic'))
const lecturerOverwork = ref([])
const venueTimeTable = ref([])
const venueRes = ref({})
const sessionId = localStorage.getItem('session_id_utm_ttms')
let adminId = localStorage.getItem('admin_id_utm_ttms') || ''
/* =========================
   PAGINATION
========================= */
const ITEMS_PER_PAGE = 5
const currentPage = ref(1)
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Chart Js
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, CategoryScale, LinearScale, Filler)
const props = defineProps(['venueTimeTable', 'venueConflicts'])


const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  indexAxis: 'y', // This flips the chart to horizontal
  scales: {
    y: {
      grid: { display: false }, // Hide horizontal lines
      ticks: { display: true }
    },
    x: {
      grid: { display: false } // Hide vertical lines
    }
  }
}

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
  console.log("venueTimeTable: ", venueTimeTable.value)

  try {
    // 1. Fetch Basic Stats (only if missing)

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
      adminId = currentAdminId
      localStorage.setItem('admin_id_utm_ttms', currentAdminId)
    }

    if (stats.value.students === 0) {
        console.log("loading students")
        const res = await fetchStudents(adminId,"2025/2026",1)
        // const res = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
        //   params: { entity: 'pelajar', session_id:sessionId, sesi: '2025/2026', semester: 1, limit:1700,offset:0 }
        // })
        //  entity=pelajar&session_id=???&sesi=yyyy/yyyy&semester=[1|2]&limit=num_&offset=num_
        stats.value.students = res.length // Update property, don't overwrite object
    }


    if (currentAdminId) {
      const lecturerData = await getStudents('pensyarah', currentAdminId, '2025/2026', 1)
      lecturerOverwork.value = lecturerData.filter(l => l.bil_seksyen > 5)
      console.log("lecturer overwork: ", lecturerOverwork.value)
    }

    // 4. Fetch Venue Timetables (The loop)
    // Optimization: Use Promise.all if the API can handle it, otherwise keep the loop
    if (venueTimeTable.value.length === 0) {
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
      localStorage.setItem('venueTimeTable', JSON.stringify(venueTimeTable.value))
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

const dayDistributionData = computed(() => {
  const dayCounts = new Array(7).fill(0)

  venueTimeTable.value.forEach(v => {
    v.timetable.forEach(item => {
      // Assuming 'hari' is 1-indexed (1=Mon) or adjust accordingly
      if (item.hari >= 1 && item.hari <= 7) {
        dayCounts[item.hari - 1]++
      }
    })
  })

  return {
    labels: dayLabels,
    datasets: [{
      label: 'Events per Day',
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'],
      data: dayCounts
    }]
  }
})

const peakHourData = computed(() => {
  // Create an array for hours 8 (8 AM) through 22 (10 PM)
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const hourCounts = new Array(hours.length).fill(0);

  venueTimeTable.value.forEach(v => {
    v.timetable.forEach(item => {
      const hour = parseInt(item.masa);
      const hourIndex = hours.indexOf(hour);

      if (hourIndex !== -1) {
        hourCounts[hourIndex]++;
      }
    });
  });

  return {
    labels: hours.map(h => `${h}:00`),
    datasets: [{
      label: 'Number of Classes',
      data: hourCounts,
      borderColor: '#4BC0C0',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      fill: true, // This makes it an Area Chart
      tension: 0.4 // Makes the line curvy
    }]
  };
});

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


</script>

<template>
  <!-- LOADING STATE -->
  <div v-if="loading" class="min-h-screen flex flex-col items-center justify-center text-gray-600 space-y-4">
    <Loader2 class="animate-spin size-10" />

    <p class="text-sm">Loading admin dashboard…</p>
  </div>

  <div v-else class="p-4 sm:p-8 space-y-6 font-sans ">
    <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Admin Dashboard</h1>
    <p class="text-gray-500 font-medium">Faculty of Computing • 2025/2026 Sem 1</p>

    <!-- LECTURER WORKLOAD -->


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
          </tr>
        </tbody>
      </table>
    </section>

    <div class="p-6 lg:p-10 bg-gray-50 min-h-screen font-sans">
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
        <KPICard title="Total Courses" :value="stats.courses" color="blue" />
        <KPICard title="Total Lecturers" :value="stats.lecturers" color="indigo" />
        <KPICard title="Total Students" :value="stats.students" color="purple" />
        <KPICard title="Total Venues" :value="stats.venue" color="emerald" />
        <KPICard title="Conflicts" :value="venueConflicts.length" color="red" :alert="true" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">

        <div class="lg:col-span-4 space-y-8">
          <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-4">Daily Load</h3>
            <div class="h-64">
              <Bar :data="dayDistributionData" :options="chartOptions" />
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 class="text-sm font-bold text-gray-400 uppercase mb-4">Peak Hour Intensity</h3>
            <div class="h-64">
              <Line :data="peakHourData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <div class="lg:col-span-8 space-y-8">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div class="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 class="text-lg font-bold text-gray-800">Conflict Monitoring</h2>
              <span class="text-xs text-red-500 font-semibold bg-red-50 px-2 py-1 rounded">Action Required</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th class="px-6 py-4">Venue</th>
                    <th class="px-6 py-4">Schedule</th>
                    <th class="px-6 py-4">Conflicting Events</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(item, index) in paginatedConflicts" :key="index" class="hover:bg-gray-50 transition">
                    <td class="px-6 py-4 font-bold text-gray-900">{{ item.kod_ruang }}</td>
                    <td class="px-6 py-4 text-sm">
                      <div class="font-medium text-gray-700">{{ formatDay(item.group[0].hari) }}</div>
                      <div class="text-gray-400">{{ formatTime(item.group[0].masa) }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <div v-for="(e, i) in item.group" :key="i" class="text-sm text-gray-600 flex items-center mb-1">
                        <span class="w-2 h-2 rounded-full bg-red-400 mr-2"></span>
                        {{ e.kod_perkara || e.subjek?.kod_subjek }}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="p-4 bg-gray-50 flex justify-between items-center text-sm border-t">
              <button @click="currentPage--" :disabled="currentPage === 1"
                class="text-blue-600 font-semibold disabled:text-gray-300">← Prev</button>
              <span class="text-gray-500">Page {{ currentPage }} / {{ totalPages }}</span>
              <button @click="currentPage++" :disabled="currentPage === totalPages"
                class="text-blue-600 font-semibold disabled:text-gray-300">Next →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
