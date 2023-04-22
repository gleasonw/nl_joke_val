<script lang="ts" setup>
import { MaxClipData } from "./CustomClip.vue";

const props = defineProps<{data: MaxClipData}>();

const {data} = props;
console.log(data)
</script>

<template>
  <div class="flex flex-col gap-5 mt-5 text-xl">
    <p>
      {{ new Date(data.time * 1000).toLocaleString() }}
    </p>
    <p>
      {{ data.twos }}
    </p>
    <TwitchClip :clipId="data.clip_id" />
  </div>
</template>
