<template>
  <footer class="w-full bg-white border-t border-gray-100 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-8 md:py-12">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">

        <div class="flex flex-col space-y-4">
          <h2 class="text-xl font-bold text-primary">UTM TTMS</h2>
          <p class="text-sm text-gray-500 leading-relaxed">
            Faculty of Computing<br>
            Universiti Teknologi Malaysia
          </p>
        </div>

        <div class="flex flex-col space-y-4">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-900">Resources</h3>
          <nav class="flex flex-col space-y-2 text-sm text-gray-500">
            <router-link :to="homeRoute" class="hover:text-primary transition-colors">
              Home
            </router-link>
            <router-link to="/timetable" class="hover:text-primary transition-colors">Timetable</router-link>
            <a href="https://utmonline.utm.my/" target="_blank" class="hover:text-primary transition-colors">UTM
              Online</a>
          </nav>
        </div>

        <div class="flex flex-col space-y-4">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-gray-900">Support</h3>
          <p class="text-sm text-gray-500">
            Having issues? Contact the admin office or visit the FC website.
          </p>
          <!-- <div class="flex justify-center md:justify-start space-x-4">
             <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-primary/10 transition-colors cursor-pointer text-gray-400 hover:text-primary">
                <small>FB</small>
             </div>
             <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-primary/10 transition-colors cursor-pointer text-gray-400 hover:text-primary">
                <small>IG</small>
             </div>
          </div> -->
        </div>

      </div>

      <div class="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-xs text-gray-400">
          © {{ new Date().getFullYear() }} UTM Timetable Management System. All rights reserved.
        </p>
        <p class="text-[10px] text-gray-300 uppercase tracking-widest font-mono">
          Built for Faculty of Computing
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { computed } from 'vue'

const role = localStorage.getItem('role')
const homeRoute = computed(() => {
  if (role === 'admin') return '/dashboard-admin'
  if (role === 'lecturer') return '/dashboard-lecturer'
  if (role === 'student') return '/dashboard-student'
  return '/login'
})

</script>

<style scoped></style>