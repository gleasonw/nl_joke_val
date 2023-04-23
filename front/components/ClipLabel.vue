<script lang="ts" setup>
import { MaxClipData } from "./CustomClip.vue";

const props = defineProps<{data: MaxClipData}>();

</script>

<template>
  <div class="flex flex-col gap-5 mt-5 text-xl">
    <p>
      {{ new Date(props.data.time * 1000).toLocaleString() }}
    </p>
    <p>
      {{ props.data.twos }}
    </p>
    <TwitchClip :clipId="props.data.clip_id" />
  </div>
</template>
