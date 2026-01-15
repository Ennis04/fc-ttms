import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user.js'
import { DashboardStudent, DashboardLecturer, DashboardAdmin, Timetable, Courses, Analysis, Venue, Lecturer, Student, Admin, Login, StudentClassTime, CoursesAnalysis } from '../pages/index.js'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login },
  { path: '/dashboard-student', component: DashboardStudent, meta: { requiresAuth: true, role: 'student' } },
  { path: '/dashboard-lecturer', component: DashboardLecturer, meta: { requiresAuth: true, role: 'lecturer' } },
  { path: '/dashboard-admin', component: DashboardAdmin, meta: { requiresAuth: true, role: 'admin' } },

  { path: '/timetable', component: Timetable, meta: { requiresAuth: true, role: ['student'] } },
  { path: '/subject-analysis', component: Analysis, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/student-analysis', component: StudentClassTime, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/courses-analysis', component: CoursesAnalysis, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/lecturer', component: Lecturer, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/students', component: Student, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, role: 'admin' } },
  { path: '/courses', component: Courses, meta: { requiresAuth: true, role: ['admin', 'lecturer'] } },
  { path: '/venue', component: Venue, meta: { requiresAuth: true, role: ['admin', 'lecturer'] } },
  { path: '/student-list', component: Student, meta: { requiresAuth: true, role: ['lecturer'] } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const user = useUserStore()
  const sessionId = localStorage.getItem('session_id_utm_ttms')
  const role = localStorage.getItem('role') || user.role

  //  Not logged in
  if (to.meta.requiresAuth && !sessionId) {
    return next('/login')
  }

  //  Role-based authorization
  if (to.meta.role) {
    const allowedRoles = Array.isArray(to.meta.role) ? to.meta.role : [to.meta.role]

    if (!allowedRoles.includes(role)) {
      // fallback based on actual role
      if (role === 'admin') return next('/dashboard-admin')
      if (role === 'lecturer') return next('/dashboard-lecturer')
      if (role === 'student') return next('/dashboard-student')
      return next('/login')
    }
  }

  // If the user hits /dashboard, redirect to the proper dashboard
  if (to.path === '/dashboard') {
    if (role === 'admin') return next('/dashboard-admin')
    if (role === 'lecturer') return next('/dashboard-lecturer')
    if (role === 'student') return next('/dashboard-student')
    return next('/login')
  }

  next()
})


export default router