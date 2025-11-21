import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    matric_no: "",
    name: "",
    description: "",
    role: "",
    isLoggedIn: false,
    sessionToken: "",
  }),
  actions: {
    login({name, matric_no, description, role, isLoggedIn, sessionToken}) {
      this.matric_no = matric_no
      this.name = name
      this.description = description
      this.role = role
      this.isLoggedIn = isLoggedIn
      this.sessionToken = sessionToken
    },
    logout() {
      localStorage.removeItem("session_id_utm_ttms")
      if(localStorage.getItem("is_admin")){
        localStorage.removeItem("is_admin")
      }
      this.matric_no = ""
      this.name = ""
      this.description = ""
      this.role = ""
      this.isLoggedIn = false
      this.sessionToken = ""
    }
  }
})
