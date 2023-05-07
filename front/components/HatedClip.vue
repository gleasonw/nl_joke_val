<script lang="ts" setup>
import { ClipResponse } from "./CustomClip.vue";
const span = ref<"day" | "week" | "month" | "year" | "">("");
const { data } = await useFetch<ClipResponse>(
  computed(
    () =>
      `https://nljokeval-production.up.railway.app/api/min_clip?span=${span.value}`
  )
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex-row flex gap-3 flex-wrap items-center">
      <h2 class="font-bold text-2xl">Low score</h2>
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
      :clipBatch="data.clips.sort((a, b) => a.count - b.count)"
    />
  </div>
</template>
