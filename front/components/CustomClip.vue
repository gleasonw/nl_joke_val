<script lang="ts" setup>
import { seriesColors } from "../app.vue";
type MaxClipData = {
  clip_id: string;
  time: number;
  twos: number;
};
const column = ref<keyof typeof seriesColors>("lol");
const span = ref<"day" | "week" | "month" | "year" | "">("");
const { data } = await useFetch<MaxClipData>(
  computed(
    () =>
      `https://nljokeval-production.up.railway.app/api/max_clip?column=${column.value}&span=${span.value}`
  )
);
</script>

<template>
  <div>
    <h2>Emote (10s)</h2>
    <div class="flex-row">
      <select v-model="column">
        <option v-for="key in Object.keys(seriesColors)" :value="key">
          {{ key }}
        </option>
      </select>
      <select v-model="span">
        <option value="">Since 4/19/23</option>
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="year">Year</option>
      </select>
    </div>
    <div v-if="data && data.time > 0">
      <p>
        {{ new Date(data.time * 1000).toLocaleString() }}
      </p>
      <p>
        {{ data.twos }}
      </p>
    </div>
    <TwitchClip v-if="data" :clipId="data.clip_id" />
  </div>
</template>
