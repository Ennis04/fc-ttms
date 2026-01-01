import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    matric_no: localStorage.getItem('matric_no') || "",
    name: "",
    description: "",
    role: "",
    isLoggedIn: false, 
    sessionToken: localStorage.getItem('session_id_utm_ttms'),
  }),
  actions: {
    setToken(){
      console.log("token have been save ")
        this.sessionToken = localStorage.getItem('session_id_utm_ttms')
        this.matric_no =  localStorage.getItem('matric_no')
    },

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
