<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { Loader2 } from "lucide-vue-next";

const rawData = ref(null);
const errorMsg = ref("");
const loading = ref(false);

const checkData = async () => {
    loading.value = true;
    try {
        // Fetch All Rooms
        // Based on your text file: Thanos => ruang -> entity=ruang
        const response = await axios.get('http://web.fc.utm.my/ttms/web_man_webservice_json.cgi', {
            params: {
                entity: 'ruang',
                // We might need a faculty code, usually '5' for Computing, but let's try without first
            }
        });
        
        console.log("Venue Data:", response.data);
        rawData.value = response.data;
    } catch (err) {
        errorMsg.value = "Error: " + err.message;
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    checkData();
})
</script>

<template>
    <div class="p-10">
        <h1 class="text-2xl font-bold mb-4">Venue Inspector</h1>
        
        <div v-if="loading" class="flex items-center gap-2 text-gray-500">
            <Loader2 class="animate-spin" /> Fetching Rooms...
        </div>

        <div v-if="errorMsg" class="bg-red-100 p-4 text-red-600 mb-4 rounded">
            {{ errorMsg }}
        </div>

        <div v-if="rawData">
            <p class="mb-2">Found {{ rawData.length }} rooms.</p>
            <h2 class="font-bold mt-4">First Room Object:</h2>
            <pre class="bg-black text-green-400 p-4 rounded text-xs font-mono h-96 overflow-auto">
{{ rawData[0] }}
            </pre>
        </div>
    </div>
</template>