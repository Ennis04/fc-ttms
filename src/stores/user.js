import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    matric_no: localStorage.getItem('matric_no') || "",
    name: localStorage.getItem('name') || "",
    description: localStorage.getItem('description') || "",
    role: localStorage.getItem('role') || "",
    isLoggedIn: !!localStorage.getItem('session_id_utm_ttms'),
    sessionToken: localStorage.getItem('session_id_utm_ttms'),
  }),
  actions: {
    setToken() {
      console.log("token have been save ")
      this.sessionToken = localStorage.getItem('session_id_utm_ttms')
      this.matric_no = localStorage.getItem('matric_no')
    },

    login({ name, matric_no, description, role, isLoggedIn, sessionToken }) {
      this.matric_no = matric_no
      this.name = name
      this.description = description
      this.role = role
      this.isLoggedIn = isLoggedIn
      this.sessionToken = sessionToken

      localStorage.setItem('name', name)
      localStorage.setItem('description', description)
      localStorage.setItem('role', role)
    },
    logout() {
      localStorage.removeItem("session_id_utm_ttms")
      localStorage.removeItem("admin_statistic")
      localStorage.removeItem("admin_id_utm_ttms")
      localStorage.removeItem("venueTimeTable")
      if(localStorage.getItem("role")){
        localStorage.removeItem("role")
      }
      sessionStorage.clear()
      this.matric_no = ""
      this.name = ""
      this.description = ""
      this.role = ""
      this.isLoggedIn = false
      this.sessionToken = ""
    }
  }
})
