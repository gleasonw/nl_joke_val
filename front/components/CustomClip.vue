<script lang="ts">
export type MaxClipData = {
  clip_id: string;
  time: number;
  twos: number;
};
</script>

<script lang="ts" setup>
import { seriesColors } from "../app.vue";

const column = ref<keyof typeof seriesColors>("lol");
const span = ref<"day" | "week" | "month" | "year" | "">("");
console.log(span.value)
const { data } = await useFetch<MaxClipData>(
  computed(
    () =>
      `https://nljokeval-production.up.railway.app/api/max_clip?column=${column.value}&span=${span.value}`
  )
);
console.log(data.value);
</script>

<template>
  <div class="flex flex-col justiy-center items-center">    
    <div class="flex-row flex gap-3 flex-wrap items-center p-2">
      <h2 class="font-bold text-2xl">Top</h2>
      <select v-model="column" class="p-2 rounded-lg hover:cursor-pointer">
        <option v-for="key in Object.keys(seriesColors)" :value="key">
          {{ key }}
        </option>
      </select>
      <h2 class="font-bold text-2xl">(10s)</h2>
      <select v-model="span" class="p-2 rounded-lg hover:cursor-pointer">
        <option value="">Since 4/19/23</option>
        <option value="day">Today</option>
        <option value="week">This week</option>
        <option value="month">This month</option>
        <option value="year">This year</option>
      </select>
    </div>
    <ClipLabel v-if="data" :data="data" />
  </div>
</template>
