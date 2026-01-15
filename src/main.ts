import { createApp } from 'vue'
// @ts-ignore
import App from './App.vue'
import { createPinia } from 'pinia'
import Toast, { POSITION } from "vue-toastification";
import "vue-toastification/dist/index.css";
// @ts-ignore
import router from './router/router.js'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

app.use(router)
app.use(Toast, {
    position: POSITION.TOP_CENTER
});
app.mount('#app')
