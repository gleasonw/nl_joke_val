<script lang="ts">
export type Clip = {
  clip_id: string;
  count: number;
  time: number;
};
export type ClipResponse = {
  clips: Clip[];
};
</script>

<script lang="ts" setup>
import { SeriesKeys } from "../app.vue";
import { seriesColors } from "../app.vue";

const column = ref<keyof typeof SeriesKeys>("two");
const span = ref<"day" | "week" | "month" | "year" | "">("");
const { data } = await useFetch<ClipResponse>(
  computed(
    () =>
      `https://nljokeval-production.up.railway.app/api/max_clip?column=${column.value}&span=${span.value}`
  )
);
</script>

<template>
  <div
    class="flex flex-col justify-center items-center border shadow-md rounded-lg p-10"
  >
    <div class="flex-row flex gap-3 flex-wrap items-center">
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
    <ClipLabel
      v-if="data && data.clips.length > 0"
      :clipBatch="data.clips.sort((a, b) => b.count - a.count)"
      :key="`${column}-${span}`"
    />
  </div>
</template>
