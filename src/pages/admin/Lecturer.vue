<script setup>
import LectureList from '@/components/chart/lecturers/LecturerList.vue';
import LecturerSection from '@/components/chart/lecturers/LecturerSection.vue';
import LecturerStudents from '@/components/chart/lecturers/LecturerStudents.vue';
import LecturerSubject from '@/components/chart/lecturers/LecturerSubject.vue';

   
</script>
<template>
    <!-- Lee Hom -->
     <!-- Can only be access by admin id -->
    <div class="w-full h-full flex items-center justify-center my-10 space-y-6 flex-col">

        <div class=" flex flex-col items-center justify-center space-y-4">
            <p class="font-bold ">Lecturer List</p>
            <LectureList/>
        </div>

        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <p class="font-bold text-sm md:text-md ">Distribution of subjects taught</p>
            <LecturerSubject/>
        </div>

        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <p class="font-bold text-sm md:text-md">Lecturer workload by number of students</p>
            <LecturerStudents/>
        </div>
        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <p class="font-bold text-sm md:text-md">Lecturer workload by number of section</p>
            <LecturerSection/>
        </div>
        
    </div>
</template>


<style lang="scss" scoped>

</style>