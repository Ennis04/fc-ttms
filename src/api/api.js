import axios from 'axios'
const baseUrl = import.meta.env.VITE_BASE_URL;

export async function fetchStudents(adminId, sesi, semester) {
  const allStudents = []
  let offset = 0
  const limit = 500
  let hasMore = true

  while (hasMore) {
    const res = await axios.get(
      'http://web.fc.utm.my/ttms/web_man_webservice_json.cgi',
      {
        params: {
          entity: 'pelajar',
          session_id: adminId,
          sesi: sesi,
          semester: semester,
          limit,
          offset
        }
      }
    )

    const data = res.data

    allStudents.push(...data)

    if (data.length < limit) {
      hasMore = false // last page
    } else {
      offset += limit
    }
  }

  console.log(allStudents.length)
  return allStudents
}

const getStudents = async (entity, session_id, sesi, semester, limit, offset) => {
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