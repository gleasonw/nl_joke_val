<script lang="ts" setup>
import { Clip } from "./CustomClip.vue";

const { data } = await useFetch<Clip[]>(
  `https://nljokeval-production.up.railway.app/api/min_clip`
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <h2 class="font-bold text-2xl">Low score (10s)</h2>
    <p><i>Let them eat cake</i></p>
    <ClipLabel v-if="data" :clip_batch="data" />
  </div>
</template>
