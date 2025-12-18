<script setup>
import { Button } from './components/ui/button';
import Login from './pages/Login.vue';
import { useUserStore } from './stores/user';
import "./style.css"
import Footer from './components/Footer.vue';
import { onMounted } from 'vue';
import Navbar from './components/Navbar.vue';

// const isAuth = localStorage.getItem("session_id_utm_ttms")
const user = useUserStore();

onMounted(() => {
  const session = localStorage.getItem("session_id_utm_ttms");
  const matric = localStorage.getItem("user_matric_no"); // <--- Get Matric
  const name = localStorage.getItem("user_full_name");   // <--- Get Name

  if (session) {
    user.isLoggedIn = true;   // Make the store reactive
    user.matric_no = matric || ""; 
    user.name = name || "User";
    user.sessionToken = session;
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Navbar  />
    <router-view />
    <!-- TODO: Footer setup -->
    <Footer />
  </div>
</template>

<style scoped></style>
