import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import { Dashboard, Timetable, Courses, Analysis, Venue, Lecturer, Student, Admin, Login, StudentClassTime, StudentList } from '../pages/index.js'

const routes = [
  { path: '/', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/timetable', component: Timetable, meta: { requiresAuth: true, role: ['student' , 'lecturer'] } },
  { path: '/subject-analysis', component: Analysis, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/student-analysis', component: StudentClassTime, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/lecturer', component: Lecturer, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/students', component: Student, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/courses', component: Courses, meta: { requiresAuth: true,role: ['admin' , 'lecturer'] } },
  { path: '/venue', component: Venue, meta: { requiresAuth: true, role: ['admin' , 'lecturer'] } },
  { path: '/student-list', component: StudentList, meta: { requiresAuth: true,role: ['lecturer'] } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const user = useUserStore()
  const session_id = localStorage.getItem("session_id_utm_ttms")

  // If user is not logged in
  if (to.meta.requiresAuth && !session_id) {
    return "/login"
  }
  
    // 2. Role-based authorization

    if (to.meta.role) {
    const allowedRoles = Array.isArray(to.meta.role)
      ? to.meta.role
      : [to.meta.role]

    if (!allowedRoles.includes(user.role)) {
      // role-based fallback
      if (user.role === "admin") return "/admin"
      return "/dashboard"
    }
  }
})


export default router