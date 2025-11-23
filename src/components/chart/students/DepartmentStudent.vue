<template>
  <div class="relative w-full max-w-full md:max-w-2xl md:w-200 md:h-80 h-50 mx-auto px-4">
    <!-- Loading Spinner -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/60 z-20">
      <Loader2 class="w-10 h-10 animate-spin text-gray-600" />
    </div>
    <!-- Chart -->
    <div :class="{ 'opacity-30 pointer-events-none': isLoading }" class="w-full h-full">
      <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Bar } from "vue-chartjs";
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { toast } from "vue-sonner";
import axios from "axios";
import getStudents from "@/api/api";
import { Loader2 } from "lucide-vue-next";

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ----------------------------------------------------
// Reactive variables
// ----------------------------------------------------
const chartData = ref(null);
const isLoading = ref(true)
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, // important for responsive height
  scales: {
    y: { 
      beginAtZero: true,
      ticks: { stepSize: 1 }
    }
  },
  plugins: {
    legend: {
      position: "top"
    },
    tooltip: {
      enabled: true
    }
  }
};

const sessionId = localStorage.getItem("session_id_utm_ttms");
const baseUrl = import.meta.env.VITE_BASE_URL;

// Analyze amount of students per department

onMounted(async () => {
  try {
    const students = await getStudents("pelajar",sessionId,"2024/2025",1,0);
  
    const countByCourses = {};
  // SECJH/SECJ/SCSJ/SECJ = Software Engineering
  // SECRH/SECR = Network Security
  // SEVH = Graphic and Multimedia
  // SECP = Data Engineering
  // SECBH = Bioinformatics
    students.forEach(s => {
      const key = s.kod_kursus;
  
      if(key==='SECJ' || key === 'SCSJ' || key === 'SECJH' || key === 'SCSEH'){
          countByCourses['SECJH'] = (countByCourses['SECJH'] || 0) + 1;
      } else if (key==='SECR' || key==='SECRH'){ // Network security 
          countByCourses['SECRH'] = (countByCourses['SECRH'] || 0) + 1;
      } else if (key==='SECVH'){ // graphic 
          countByCourses['SECVH'] = (countByCourses['SECVH'] || 0) + 1;
      } else if (key==='SECPH'){ // data engineering 
          countByCourses['SECPH'] = (countByCourses['SECPH'] || 0) + 1;
      } else if (key==='SECBH'){ // bioinformatics
          countByCourses['SECBH'] = (countByCourses['SECBH'] || 0) + 1;
      } else {
          countByCourses['Others'] = (countByCourses['Others'] || 0) + 1;
      }
      // software engineering: 310
      // network security: 262
      // 
      // if (!countByCourses[key]) countByCourses[key] = 0;
      // countByCourses[key]++;
    });
  
    const labels = Object.keys(countByCourses);
    const values = Object.values(countByCourses);
    
    //     const datasets = labels.map((label, index) => ({
    //   label: label,
    //   data: [values[index]], // single bar per dataset
    //   backgroundColor: [
    //     "rgba(75, 192, 192, 0.7)",
    //     "rgba(255, 99, 132, 0.7)",
    //     "rgba(255, 205, 86, 0.7)",
    //     "rgba(54, 162, 235, 0.7)",
    //     "rgba(153, 102, 255, 0.7)",
    //     "rgba(201, 203, 207, 0.7)",
    //   ][index % 6] // loop colors
    // }));
    chartData.value = {
      labels,
      datasets: [
        {
          label: "Amount of students",
          data: values,
          backgroundColor:[
              "rgba(75, 192, 192, 0.7)",
              "rgba(255, 99, 132, 0.7)",
              "rgba(255, 205, 86, 0.7)",
              "rgba(54, 162, 235, 0.7)",
          ]
        }
      ]
    };
  } catch (error) {
      console.error("Error loading chart:", error);
  } finally {
    isLoading.value = false
  }
});
</script>

<style>

</style>
