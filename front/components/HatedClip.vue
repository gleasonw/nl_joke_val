<script lang="ts" setup>
type MinClipData = {
  clip_id: string;
  time: number;
  twos: number;
};

const { data } = await useFetch<MinClipData>(
  `https://nljokeval-production.up.railway.app/api/min_clip`
);
console.log(data.value);
</script>

<template>
  <div class="flex flex-col gap-2">
    <h2 class="font-bold text-2xl">Low score (10s)</h2>
    <p><i>Let them eat cake</i></p>
    <ClipLabel v-if="data" :data="data" />
  </div>
</template>
