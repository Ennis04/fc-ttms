import {createRouter,createWebHistory} from 'vue-router'
import { useUserStore } from '../stores/user.js'
import { Home, Timetable, Courses, Analysis, Venue, Lecturer, Student, Admin, Login , StudentClassTime} from '../pages/index.js'

const routes = [
    { path: '/' , component: Home  },
    { path: '/login' , component: Login   },
    { path: '/home' , component: Home, meta: {requiresAuth: true}  },
    { path: '/timetable' , component: Timetable ,meta: {requiresAuth: true}  },
    { path: '/courses' , component: Courses  },
    { path: '/subject-analysis' , component: Analysis  },
    { path: '/student-analysis' , component: StudentClassTime  },
    { path: '/venue' , component: Venue  },
    { path: '/lecturer' , component: Lecturer  },
    { path: '/students' , component: Student  },
    { path: '/admin' , component: Admin  },
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

  // If route requires a specific role
  // Check if route requires a specific role
  if (to.meta.role && user.role !== to.meta.role) {
    // Redirect based on role or fallback
    if (user.role === "student") return "/home"
    if (user.role === "admin") return "/admin"
    return "/" // fallback
  }
})


export default router