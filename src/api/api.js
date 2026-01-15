import axios from 'axios'
const baseUrl = import.meta.env.VITE_BASE_URL;

const getStudents = async (entity,session_id,sesi,semester,limit,offset) => {
  try {
    if (session_id && entity) {

      const response = await axios.get(baseUrl, {
        params: {
          entity: entity,
          session_id: session_id,
          sesi: sesi || "2024/2025",
          semester: semester || 1,
          limit: limit || null,
          offset: offset || 0
        }
      });

      // console.log("Students:", response.data);
      return response.data || []; // ensure array
    } else {
        console.log("Missing session_id or entity")
        return []
    }
  } catch (error) {
    console.log("Error fetching student data:", error);
    toast.error("Error fetching student data");
    return [];
  }
};

export default getStudents