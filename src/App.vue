<script setup>
  import { Button } from './components/ui/button';
  import Login from './pages/Login.vue';
import { useUserStore } from './stores/user';
  import "./style.css"
  import Navbar from './components/navbar.vue';
  import Footer from './components/Footer.vue';
import { onMounted } from 'vue';

  // const isAuth = localStorage.getItem("session_id_utm_ttms")
  const user = useUserStore(); 

  onMounted(() => {
  const session = localStorage.getItem("session_id_utm_ttms");

  if (session) {
    user.isLoggedIn = true;   // Make the store reactive
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <Navbar v-if="user.isLoggedIn"/>
    <router-view />
    <Footer/>
  </div>
</template>

<style scoped></style>
