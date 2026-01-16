<script setup>
import { Button } from "@/components/ui/button"
import { useUserStore } from "@/stores/user"
import { ChartLine, GraduationCap, House, LibraryBig, School, Sheet, Users, UserStar, FileUser } from "lucide-vue-next"

import { onMounted, ref, computed } from "vue"
import { useRouter } from "vue-router"
import { toast } from "vue-sonner"

const drawerOpen = ref(false)
const analysisToggle = ref(false)

const user = useUserStore()
const router = useRouter()

const role = computed(() => user.role)

// toggle
const toggleDrawer = () => {
    drawerOpen.value = !drawerOpen.value
}

const handleLogout = () => {
    user.logout()
    toast.success("Logged out successfully!", { id: "logout-success" })
    router.push("/login")
}

const goToPages = (page) => {
    router.push(page)
}

// restore login on refresh
onMounted(() => {
    const session = localStorage.getItem("session_id_utm_ttms")
    if (session) {
        user.isLoggedIn = true
        user.role = localStorage.getItem("role") // restore role
    }
})
</script>

<template>
    <div>
        <!-- Navbar -->
        <nav class="hidden md:flex items-center px-6 py-4 shadow-md">
            <!-- Left -->
            <div class="flex items-center gap-6">
                <img src="../assets/utm-logo.png" class="h-10 object-cover" />

                <router-link v-if="user.isLoggedIn && role === 'student'" to="/dashboard-student " class="nav-link">
                    Dashboard
                </router-link>

                <router-link v-if="user.isLoggedIn && role === 'lecturer'" to="/dashboard-lecturer" class="nav-link">
                    Dashboard
                </router-link>

                <router-link v-if="user.isLoggedIn && role === 'admin'" to="/dashboard-admin" class="nav-link">
                    Dashboard
                </router-link>

                <router-link v-if="user.isLoggedIn && role == 'student'" to="/timetable" class="nav-link">
                    Timetable
                </router-link>

                <router-link v-if="user.isLoggedIn && role !== 'student'" to="/courses" class="nav-link">
                    Courses
                </router-link>

                <router-link v-if="user.isLoggedIn && role === 'lecturer'" to="/student-list" class="nav-link">
                    Student List
                </router-link>

                <!-- Admin dropdown -->
                <div v-if="user.isLoggedIn && role === 'admin'" class="relative">
                    <button class="nav-link" @click="analysisToggle = !analysisToggle">
                        Analysis
                    </button>

                    <div v-if="analysisToggle"
                        class="absolute top-full mt-2 bg-white border rounded-md shadow-lg w-44 z-50 flex flex-col p-3 gap-3">
                        <router-link to="/subject-analysis" class="dropdown-link" @click="analysisToggle = false">
                            Subject Analysis
                        </router-link>
                        <router-link to="/student-analysis" class="dropdown-link" @click="analysisToggle = false">
                            Student Analysis
                        </router-link>
                    </div>
                </div>

                <router-link v-if="user.isLoggedIn && role !== 'student'" to="/venue" class="nav-link">
                    Venue
                </router-link>

                <router-link v-if="user.isLoggedIn && role === 'admin'" to="/lecturer" class="nav-link">
                    Lecturer
                </router-link>

                <router-link v-if="user.isLoggedIn && role === 'admin'" to="/students" class="nav-link">
                    Students
                </router-link>
                <!-- <router-link v-if="user.isLoggedIn && role === 'admin'" to="/courses-analysis" class="nav-link">
                    Courses
                </router-link> -->
            </div>

            <!-- Right -->
            <div class="ml-auto">
                <Button v-if="user.isLoggedIn" variant="outline" @click="handleLogout">
                    Logout
                </Button>

                <Button v-else variant="outline" @click="router.push('/login')">
                    Login
                </Button>
            </div>
        </nav>


        <!-- Mobile Navbar -->
        <nav class="md:hidden flex items-center px-4 py-4 shadow-md">
            <button @click="toggleDrawer">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 5h18" />
                    <path d="M3 12h18" />
                    <path d="M3 19h18" />
                </svg>
            </button>
            <img src="../assets/utm-logo.png" class="h-10 object-cover ml-4" />
        </nav>

        <!-- Drawer Background Overlay -->
        <div v-if="drawerOpen" class="fixed inset-0 bg-black/50 z-40" @click="toggleDrawer"></div>
        <!-- Drawer Panel -->
        <div class="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300"
            :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'">
            <div class="py-10 px-5 space-y-4">
                <img src="../assets/utm-logo.png" class="h-12 object-cover" />

                <div class="flex flex-col space-y-3 mt-7">
                    <button class="drawer-list" @click="goToPages('/dashboard-student'); toggleDrawer()"
                        v-if="user.isLoggedIn && role === 'student'">
                        <House />
                        Dashboard
                    </button>

                    <button class="drawer-list" @click="goToPages('/dashboard-lecturer'); toggleDrawer()"
                        v-if="user.isLoggedIn && role === 'lecturer'">
                        <House />
                        Dashboard
                    </button>

                    <button class="drawer-list" @click="goToPages('/dashboard-admin'); toggleDrawer()"
                        v-if="user.isLoggedIn && role === 'admin'">
                        <House />
                        Dashboard
                    </button>

                    <button v-if="user.isLoggedIn && role !== 'admin'" class="drawer-list"
                        @click="goToPages('/timetable'); toggleDrawer()">
                        <Sheet />
                        Timetable
                    </button>

                    <button v-if="user.isLoggedIn && (role === 'admin' || role === 'lecturer')" class="drawer-list"
                        @click="goToPages('/courses'); toggleDrawer()">
                        <LibraryBig />
                        Courses
                    </button>

                    <!-- Admin Analysis (matches desktop logic) -->
                    <div v-if="role === 'admin'" class="space-y-1">
                        <button class="drawer-list font-semibold">
                            <ChartLine />
                            Analysis
                        </button>

                        <button class="drawer-sub" @click="goToPages('/subject-analysis'); toggleDrawer()">
                            Subject Analysis
                        </button>

                        <button class="drawer-sub" @click="goToPages('/student-analysis'); toggleDrawer()">
                            Student Analysis
                        </button>
                    </div>

                    <button v-if="user.isLoggedIn && (role === 'admin' || role === 'lecturer')" class="drawer-list"
                        @click="goToPages('/student-list'); toggleDrawer()">
                        <FileUser />
                        Stundet List
                    </button>

                    <button v-if="user.isLoggedIn && (role === 'admin' || role === 'lecturer')" class="drawer-list"
                        @click="goToPages('/venue'); toggleDrawer()">
                        <School />
                        Venue
                    </button>

                    <button v-if="role === 'admin'" class="drawer-list" @click="goToPages('/lecturer'); toggleDrawer()">
                        <Users />
                        Lecturer
                    </button>

                    <button v-if="role === 'admin'" class="drawer-list" @click="goToPages('/students'); toggleDrawer()">
                        <GraduationCap />
                        Students
                    </button>

                </div>

                <div class="border-t px-5 py-4">
                    <Button class="w-full" variant="outline" @click="handleLogout">
                        Logout
                    </Button>
                </div>

            </div>
        </div>
    </div>
</template>
