<script setup>
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ref } from "vue"
import { useUserStore } from "../stores/user.js"
import { useToast } from "vue-toastification"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "vue-router"
import axios from 'axios'
import { Eye, EyeClosed, EyeClosedIcon } from "lucide-vue-next"

const router = useRouter()
const user = useUserStore()
const toast = useToast()
const utm_id = ref("")
const password = ref("")
const role = ref("")
const showPassword = ref(false)

const login = async () => {
  if (utm_id.value === "" || password.value === "" || role.value === "") {
    toast.error("Please fill in all fields", { id: "login-error" })
    return
  }
  try {
    const response = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
      params: {
        entity: "authentication",
        login: utm_id.value,
        password: password.value,
      }
    })

    const data = response.data[0]

    if(role.value === "student/lecturer"){

      if (data && data.session_id) {
        user.login({ matric_no: data.login_name, description: data.description, name: data.full_name, isLoggedIn: true, role: role.value, sessionToken: data.session_id })
  
        // store session_id in localStorage
        localStorage.setItem("session_id_utm_ttms",data.session_id)
        console.log("user session id: ", data.session_id)
      } else {
          toast.error("Invalid credentials. Please try again.", { id: "login-failed" })
        return
      }
      
    } else if(role.value === "admin"){
      // Get the admin session_id from backend
      const adminResponse = await axios.get('http://web.fc.utm.my/ttms/auth-admin.php',{
        params: {
          session_id:data.session_id
        }
      })
      const adminData = adminResponse.data[0]
        if (adminData && adminData.session_id) {
          user.login({ matric_no: "admin", description: "admin", name: "Admin", isLoggedIn: true, role: role.value, sessionToken: adminData.session_id })
    
          // store session_id in localStorage
          localStorage.setItem("session_id_utm_ttms",adminData.session_id)
          localStorage.setItem("is_admin","true")
          console.log("admin session id: ", adminData.session_id)
        } else {
            toast.error("Invalid credentials. Please try again.", { id: "login-failed" })
          return
        }
    } else {
      toast.error("Please select a valid role", { id: "login-error" })
      return
    }

    toast.success("Login successful!", { id: "login-success",timeout: 2000 })
    router.push("/home")
  } catch (error) {
    toast.error("Login failed. Please try again.", { id: "login-failed" })
    console.error("Login error:", error)
  }

}
</script>

<template>
  <div class="w-screen h-screen flex items-center justify-center bg-gray-100">
    <Card class="w-[380px]">
      <CardHeader>
        <div class="w-full flex justify-center mb-4">
          <img src="../assets/utm-logo.png" alt="utm-logo" class="w-50 object-fill" />
        </div>
        <CardTitle class="text-2xl text-center text-primary">TTMS SYSTEM</CardTitle>
        <CardDescription class="text-center">
          Please sign in to continue
        </CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>UTM ID</Label>
          <Input v-model="utm_id" type="id" placeholder="UTM ID" />
        </div>

        <div class="space-y-2 relative">
          <Label>Password</Label>
          <Input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Password" class="pr-10" />
          <!-- Eye button -->
          <button type="button" @click="showPassword = !showPassword"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 ">
            <span v-if="showPassword"><Eye class="size-5"/></span>
            <span v-else><EyeClosedIcon class="size-5"/></span>
          </button>
        </div>

        <div class="space-y-2">
          <Label>Role</Label>
          <Select v-model="role" class="w-full">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="Select a Roles" />
            </SelectTrigger>
            <SelectContent class="w-full">
              <SelectGroup class="flex flex-col gap-2 p-2">
                <SelectItem value="admin" class="w-full hover:bg-gray-100 p-2">Admin</SelectItem>
                <SelectItem value="student/lecturer" class="w-full hover:bg-gray-100 p-2">Lecturer/Student</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="w-full flex justify-end">
          <button class="text-primary underline text-xs cursor-pointer">Forgot Passsword ?</button>
        </div>
      </CardContent>

      <CardFooter>
        <Button @click="login" class="w-full">
          Login
        </Button>
      </CardFooter>
    </Card>
  </div>
</template>

<style scoped></style>
