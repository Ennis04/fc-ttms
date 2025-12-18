<script setup>
import { Button } from "@/components/ui/button"; // shadcn Button import
import { useUserStore } from "@/stores/user";
import { ChartLine, GraduationCap, House, LibraryBig, School, Sheet, Users, UserStar } from "lucide-vue-next";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const drawerOpen = ref(false)
const user = useUserStore()
const router = useRouter()
const isAdmin = localStorage.getItem("is_admin") ? true : false
const analysisToggle = ref(false)

function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
}
const handleLogout = () => {
    // Add your logout logic here, e.g., clearing auth tokens
    console.log("user logging out")
    user.logout()
    toast.success("Logged out successfully!", { id: "logout-success" })
    router.push("login")
};

const goToPages = (page) => {
    router.push(page)
}

onMounted(() => {
    const session = localStorage.getItem("session_id_utm_ttms");

    if (session) {
        user.isLoggedIn = true;   // Make the store reactive
    }
});

</script>
<template>
    <div>
        <!-- Navbar -->
        <nav class="hidden md:flex justify-between items-center px-6 py-4 shadow-md">
            <div class="flex items-center justify-between space-x-4 w-1/2">
                <img src="../assets/utm-logo.png" class="h-10 w-30 object-cover" />
                <a href="/" class="text-black hover:text-gray-900" v-if="user.isLoggedIn">Dashboard</a>
                <a href="/timetable" class="text-black hover:text-gray-900" v-if="user.isLoggedIn">Timetable</a>
                <a href="/courses" class="text-black hover:text-gray-900" v-if="user.isLoggedIn">Courses</a>
                <div class="relative text-black hover:text-gray-900 cursor-pointer"
                    v-if="user.isLoggedIn">
                    <span @click="analysisToggle = !analysisToggle">
                        Analysis
                    </span>
                    <div v-if="analysisToggle"
                        class="absolute mt-2 bg-white border rounded shadow-lg p-2 flex flex-col items-center space-y-2 z-50 w-40">
                        <router-link to="/subject-analysis" class="hover:bg-gray-100 p-1 border-b-2" @click="analysisToggle = false">
                            Subject Analysis
                        </router-link>
                        <router-link to="/student-analysis" class="hover:bg-gray-100 p-1" @click="analysisToggle = false">
                            Student Analysis
                        </router-link>
                    </div>
                </div>
                <a href="/venue" class="text-black hover:text-gray-900" v-if="user.isLoggedIn">Venue</a>
                <a href="/lecturer" class="text-black hover:text-gray-900"
                    v-if="user.isLoggedIn && user.role == 'admin'">Lecturer</a>
                <a href="/students" class="text-black hover:text-gray-900"
                    v-if="user.isLoggedIn && user.role == 'admin'">Student</a>
                <!-- <a href="/admin" v-if="isAdmin" class="text-black hover:text-gray-900" >Admin</a> -->
            </div>

            <Button variant="outline" color="destructive" @click="handleLogout" v-if="user.isLoggedIn">
                Logout
            </Button>
            <Button variant="outline" color="destructive" @click="handleLogout" v-if="!user.isLoggedIn">
                Login
            </Button>
        </nav>

        <!-- Mobile Navbar -->
        <nav class="md:hidden flex justify-start items-center px-4 py-4 shadow-md space-x-4">
            <button @click="toggleDrawer">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="lucide lucide-text-align-justify-icon lucide-text-align-justify">
                    <path d="M3 5h18" />
                    <path d="M3 12h18" />
                    <path d="M3 19h18" />
                </svg>
            </button>
            <img src="../assets/utm-logo.png" class="h-10 object-cover" />

            <!-- Hamburger -->
        </nav>
        <!-- Drawer Background Overlay -->
        <div v-if="drawerOpen" class="fixed inset-0 bg-black/50 z-40" @click="toggleDrawer"></div>
        <!-- Drawer Panel -->
        <div class="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300"
            :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'">
            <div class="py-10 px-5 space-y-4">
                <img src="../assets/utm-logo.png" class="h-12 object-cover" />

                <div class="flex flex-col space-y-3 mt-7">
                    <button class="drawer-list" @click="goToPages('/')">
                        <House class="text-black" />
                        Dashboard
                    </button>
                    <button class="drawer-list" @click="goToPages('/timetable')">
                        <Sheet class="text-black" />
                        Timetable
                    </button>
                    <button class="drawer-list" @click="goToPages('/courses')">
                        <LibraryBig class="text-black" />
                        Courses
                    </button>
                    <button class="drawer-list" @click="goToPages('/analysis')">
                        <ChartLine class="text-black" />
                        Analysis
                    </button>
                    <button class="drawer-list" @click="goToPages('/venue')">
                        <School class="text-black" />
                        Venue
                    </button>
                    <button class="drawer-list" @click="goToPages('/lecturer')">
                        <Users class="text-black" />
                        Lecturer
                    </button>
                    <button class="drawer-list" @click="goToPages('/students')">
                        <GraduationCap class="text-black" />
                        Student
                    </button>
                    <button class="drawer-list" v-if="isAdmin" @click="goToPages('/admin')">
                        <UserStar class="text-black" />
                        Admin
                    </button>
                </div>

                <Button variant="outline" class="w-full mt-6 text-white bg-primary" @click="handleLogout">
                    Logout
                </Button>
            </div>
        </div>
    </div>
</template>


<style scoped>
/* optional: make navbar sticky */
nav {
    position: sticky;
    top: 0;
    z-index: 50;
}
</style>
