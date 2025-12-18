<script setup>
import getStudents from '@/api/api';
import Button from '@/components/ui/button/Button.vue';
import Table from '@/components/ui/table/Table.vue';
import TableCaption from '@/components/ui/table/TableCaption.vue';
import TableCell from '@/components/ui/table/TableCell.vue';
import TableHead from '@/components/ui/table/TableHead.vue';
import TableHeader from '@/components/ui/table/TableHeader.vue';
import TableRow from '@/components/ui/table/TableRow.vue';
import { useUserStore } from '@/stores/user';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';

const sessionId = localStorage.getItem("session_id_utm_ttms");
const lecturers = ref([]);
const isLoading = ref(true);

// Search / Filter
const searchQuery = ref("");
const selectedNoSubject = ref("");
const selectedNoSection = ref('')
const selectedYear = ref("");

// Pagination
const currentPage = ref(1);
const pageSize = 10;

const user = useUserStore()

// Clear filter
const clearFilter = () => {
  searchQuery.value = "";
  selectedNoSubject.value = "";
  selectedNoSection.value = "";
  selectedYear.value = "";
  currentPage.value = 1;
};

    //    "bil_pelajar":89,
    //   "bil_seksyen":3,
    //   "no_pekerja":30744,
    //   "nama":"ADILA FIRDAUS BINTI ARBAIN",
    //   "bil_subjek":2 

// Ascending number of subjects
const subjects = computed(() =>
  [...new Set(lecturers.value.map((s) => s.bil_subjek))].sort((a,b)=>a-b)
);

const sections = computed(() =>
  [...new Set(lecturers.value.map((s) => s.bil_seksyen))].sort((a,b)=>a-b)
);

// -----------------------------
// FILTERED STUDENTS (computed)
// -----------------------------
const filteredLecturers = computed(() => {
  return lecturers.value.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.no_pekerja.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesNoSubjects =
      selectedNoSubject.value === "" || s.bil_subjek === selectedNoSubject.value;

    const matchesNoSections =
      selectedNoSection.value === "" || s.bil_seksyen === selectedNoSection.value;

    const matchesYear =
      selectedYear.value === "" ||
      String(s.tahun_kursus) === selectedYear.value;

    return matchesSearch && matchesNoSubjects && matchesNoSections;
  });
});

// -----------------------------
// TOTAL PAGES (computed)
// -----------------------------
const totalPages = computed(() => {
  return Math.ceil(filteredLecturers.value.length / pageSize);
});

// -----------------------------
// PAGINATED STUDENTS (computed)
// -----------------------------
const paginatedLecturers = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredLecturers.value.slice(start, start + pageSize);
});

// -----------------------------
// PAGE CONTROLS
// -----------------------------
const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++;
};

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--;
};

// -----------------------------
// FETCH STUDENTS
// -----------------------------
onMounted(async () => {
  try {
    lecturers.value = await getStudents(
      "pensyarah",
      user.sessionToken,
      "2024/2025",
      0,
    );
    console.log(`Lecturers data: ${JSON.stringify(lecturers.value, null, 2)}`);
  } catch (error) {
    console.log("Error fetching lecturers list: ", error);
    toast.error("Failed to load lecturers list.", {
      id: "lecturers-load-failed",
    });
  } finally {
    isLoading.value = false;
  }
});

</script>
<template>
  <div class="relative overflow-x-auto md:w-300 w-95 px-2 md:px-6 ">

    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/60 z-20">
      <Loader2 class="w-10 h-10 animate-spin text-gray-600" />
    </div>
    
    <!-- Search & Filter -->
    <div class="flex flex-col md:flex-row md:items-center gap-4 mb-4">

      <!-- Search -->
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search by name or employee ID..."
        class="border px-4 py-2 rounded w-full md:w-1/3"
      />

      <!-- Number of subjects -->
      <select
        v-model="selectedNoSubject"
        class="border px-4 py-2 rounded w-full md:w-auto"
      >
        <option value="">Subject</option>
        <option v-for="subject in subjects" :key="subject" :value="subject">
          {{ subject }}
        </option>
      </select>
      
      <!-- Number of sections -->
      <select
        v-model="selectedNoSection"
        class="border px-4 py-2 rounded w-full md:w-auto"
      >
        <option value="">Section</option>
        <option v-for="section in sections" :key="section" :value="section">
          {{ section }}
        </option>
      </select>


      <Button class="w-full md:w-auto" @click="clearFilter">
        Clear Filter
      </Button>
    </div>

    <!-- Desktop Table -->
    <div class="hidden md:block min-w-[800px] w-full">

      <div class="text-lg font-semibold text-gray-700 py-4 bg-gray-50 text-center">
        A list of lecturers in Faculty Computing
      </div>

      <div class="grid grid-cols-5 bg-gray-100 border-b font-semibold">
        <div class="px-6 py-4">No Pekerja</div>
        <div class="px-6 py-4">Name</div>
        <div class="px-6 py-4">Number of subjects</div>
        <div class="px-6 py-4 text-center">Number of students</div>
        <div class="px-6 py-4 text-center">Number of sections</div>
      </div>

      <div class="h-100 overflow-y-auto">
          <div
            v-for="(lecturer, index) in paginatedLecturers"
            :key="lecturer.no_matrik"
            :class="[
              'grid grid-cols-5 border-b transition-colors',
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              'hover:bg-blue-50'
            ]"
          >
            <div class="px-6 py-4 flex items-center">{{ lecturer.no_pekerja }}</div>
            <div class="px-6 py-4 flex items-center">{{ lecturer.nama }}</div>
            <div class="px-6 py-4 flex items-center">{{ lecturer.bil_subjek }}</div>
            <div class="px-6 py-4 text-center flex items-center justify-center">
              {{ lecturer.bil_pelajar }}
            </div>
            <div class="px-6 py-4 text-center flex items-center justify-center">
            {{ lecturer.bil_seksyen }}
            </div>
          </div>
      </div>
    </div>

    <!-- Mobile Card List -->
    <div class="md:hidden flex flex-col gap-3">
        <div class="overflow-y-auto h-100">   
            <div
            v-for="lecturer in paginatedLecturers"
            :key="lecturer.no_matrik"
            class="bg-white p-4 rounded-lg shadow border"
            >
            <div class="font-semibold text-lg">{{ lecturer.nama }}</div>
            <div class="text-sm text-gray-600">Empoyee ID: {{ lecturer.no_pekerja }}</div>
            <div class="text-sm text-gray-600">Number of subjects : {{ lecturer.bil_subjek }}</div>
            <div class="text-sm text-gray-600">Number of students: {{ lecturer.bil_pelajar }}</div>
            <div class="text-sm text-gray-600">Number of sections: {{ lecturer.bil_seksyen }}</div>
            </div>
        </div>
    </div>

    <!-- Pagination -->
    <div class="w-full flex items-center justify-between py-6">

      <button
        @click="prevPage"
        :disabled="currentPage === 1"
        class="px-3 py-2 border rounded disabled:opacity-40"
      >
        Prev
      </button>

      <span class="text-gray-700 font-medium">
        Page {{ currentPage }} of {{ totalPages }}
      </span>

      <button
        @click="nextPage"
        :disabled="currentPage === totalPages"
        class="px-3 py-2 border rounded disabled:opacity-40"
      >
        Next
      </button>

    </div>

  </div>
</template>

<style scoped></style>