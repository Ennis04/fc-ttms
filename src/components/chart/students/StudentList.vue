<script setup>
import getStudents from '@/api/api';
import Button from '@/components/ui/button/Button.vue';
import Table from '@/components/ui/table/Table.vue';
import TableCaption from '@/components/ui/table/TableCaption.vue';
import TableCell from '@/components/ui/table/TableCell.vue';
import TableHead from '@/components/ui/table/TableHead.vue';
import TableHeader from '@/components/ui/table/TableHeader.vue';
import TableRow from '@/components/ui/table/TableRow.vue';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';
import { toast } from 'vue-sonner';

const sessionId = localStorage.getItem("session_id_utm_ttms");
const students = ref([]);
const isLoading = ref(true);

// Search / Filter
const searchQuery = ref("");
const selectedCourse = ref("");
const selectedYear = ref("");

// Pagination
const currentPage = ref(1);
const pageSize = 10;

// Clear filter
const clearFilter = () => {
  searchQuery.value = "";
  selectedCourse.value = "";
  selectedYear.value = "";
  currentPage.value = 1;
};

// Unique course list
const courses = computed(() =>
  [...new Set(students.value.map((s) => s.kod_kursus))]
);

// -----------------------------
// FILTERED STUDENTS (computed)
// -----------------------------
const filteredStudents = computed(() => {
  return students.value.filter((s) => {
    const matchesSearch =
      s.nama.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.no_matrik.toLowerCase().includes(searchQuery.value.toLowerCase());

    const matchesCourse =
      selectedCourse.value === "" || s.kod_kursus === selectedCourse.value;

    const matchesYear =
      selectedYear.value === "" ||
      String(s.tahun_kursus) === selectedYear.value;

    return matchesSearch && matchesCourse && matchesYear;
  });
});

// -----------------------------
// TOTAL PAGES (computed)
// -----------------------------
const totalPages = computed(() => {
  return Math.ceil(filteredStudents.value.length / pageSize);
});

// -----------------------------
// PAGINATED STUDENTS (computed)
// -----------------------------
const paginatedStudents = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredStudents.value.slice(start, start + pageSize);
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
    students.value = await getStudents(
      "pelajar",
      sessionId,
      "2024/2025",
      0,
    );
  } catch (error) {
    console.log("Error fetching students list: ", error);
    toast.error("Failed to load students list.", {
      id: "students-load-failed",
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
        placeholder="Search by name or matric no..."
        class="border px-4 py-2 rounded w-full md:w-1/3"
      />

      <!-- Course -->
      <select
        v-model="selectedCourse"
        class="border px-4 py-2 rounded w-full md:w-auto"
      >
        <option value="">All Courses</option>
        <option v-for="course in courses" :key="course" :value="course">
          {{ course }}
        </option>
      </select>

      <!-- Year -->
      <select
        v-model="selectedYear"
        class="border px-4 py-2 rounded w-full md:w-auto"
      >
        <option value="">All Years</option>
        <option value="1">Year 1</option>
        <option value="2">Year 2</option>
        <option value="3">Year 3</option>
        <option value="4">Year 4</option>
      </select>

      <Button class="w-full md:w-auto" @click="clearFilter">
        Clear Filter
      </Button>
    </div>

    <!-- Desktop Table -->
    <div class="hidden md:block min-w-[800px] w-full">

      <div class="text-lg font-semibold text-gray-700 py-4 bg-gray-50 text-center">
        A list of students in Faculty Computing
      </div>

      <div class="grid grid-cols-5 bg-gray-100 border-b font-semibold">
        <div class="px-6 py-4">No Matrik</div>
        <div class="px-6 py-4">Name</div>
        <div class="px-6 py-4">Course</div>
        <div class="px-6 py-4 text-center">Subject</div>
        <div class="px-6 py-4 text-center">Year</div>
      </div>

      <div class="h-100 overflow-y-auto">
          <div
            v-for="(student, index) in paginatedStudents"
            :key="student.no_matrik"
            :class="[
              'grid grid-cols-5 border-b transition-colors',
              index % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              'hover:bg-blue-50'
            ]"
          >
            <div class="px-6 py-4 flex items-center">{{ student.no_matrik }}</div>
            <div class="px-6 py-4 flex items-center">{{ student.nama }}</div>
            <div class="px-6 py-4 flex items-center">{{ student.kod_kursus }}</div>
            <div class="px-6 py-4 text-center flex items-center justify-center">
              {{ student.bil_subjek }}
            </div>
            <div class="px-6 py-4 text-center flex items-center justify-center">
              Tahun {{ student.tahun_kursus }}
            </div>
          </div>
      </div>
    </div>

    <!-- Mobile Card List -->
    <div class="md:hidden flex flex-col gap-3">
        <div class="overflow-y-auto h-100">   
            <div
            v-for="student in paginatedStudents"
            :key="student.no_matrik"
            class="bg-white p-4 rounded-lg shadow border"
            >
            <div class="font-semibold text-lg">{{ student.nama }}</div>
            <div class="text-sm text-gray-600">Matric: {{ student.no_matrik }}</div>
            <div class="text-sm text-gray-600">Course: {{ student.kod_kursus }}</div>
            <div class="text-sm text-gray-600">Subjects: {{ student.bil_subjek }}</div>
            <div class="text-sm text-gray-600">Year: {{ student.tahun_kursus }}</div>
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