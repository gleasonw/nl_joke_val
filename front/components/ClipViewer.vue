<script lang="ts" setup>
import { seriesColors } from "../app.vue";
type ClipData = {
  clip_id: string;
  time: number;
};
const props = defineProps({
  time: Number,
});
const { data } = await useFetch<ClipData>(
  computed(
    () =>
      `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`
  )
);
</script>

<template>
  <div class="flex flex-col gap-5 justify-between">
    <h2 class="font-bold text-2xl">Click graph to pull nearest clip</h2>
    <p class="italic">group by second for precision</p>
    <p v-if="data && data.time > 0">
      {{ new Date(data.time * 1000).toLocaleString() }}
    </p>
    <TwitchClip v-if="data" :clipId="data.clip_id" />
  </div>
</template>
