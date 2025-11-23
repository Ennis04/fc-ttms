<script setup>
    import CoursesStudent from '@/components/chart/students/CoursesStudent.vue';
    import DepartmentStudent from '@/components/chart/students/DepartmentStudent.vue';
    import StudentList from '@/components/chart/students/StudentList.vue';
    import YearStudents from '@/components/chart/students/YearStudents.vue';
</script>
<template>
    <!-- Lee Hom -->
     <!-- Can only be access by admin id -->
    <div class="w-full h-full flex items-center justify-center my-10 space-y-6 flex-col">

        <div class=" flex flex-col items-center justify-center space-y-4">
            <!-- TODO: User can customize the data based on semester, year -->
            <p class="font-bold ">Student List</p>
            <StudentList/>
        </div>

        <!-- TODO: Add loading animation -->
        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <!-- TODO: User can customize the data based on semester, year -->
            <p class="font-bold text-sm md:text-md ">Amount of subjects taken by student</p>
            <CoursesStudent/> 
        </div>

        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <!-- TODO: User can customize the data based on semester, year -->
            <p class="font-bold text-sm md:text-md">Amount of students per departments</p>
            <p class="text-xs md:text-sm ">Shows how students are distributed across courses.</p>
            <DepartmentStudent/>
        </div>
        <div class=" flex flex-col items-center justify-center space-y-2 shadow-md rounded-2xl px-3 py-2">
            <!-- TODO: User can customize the data based on semester, year -->
            <p class="font-bold text-sm md:text-md">Year of Study Distribution</p>
            <p class="text-xs md:text-sm">Shows how students are spread across academic years.</p>
            <YearStudents/>
        </div>
        
    </div>
</template>


<style lang="scss" scoped>

</style>