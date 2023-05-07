<script lang="ts" setup>
import { Clip } from "./CustomClip.vue";

const props = defineProps<{ clipBatch: Clip[] }>();
const selectedIndex = ref(0);
console.log(props.clipBatch)
const currentClip = computed(() => props.clipBatch?.[selectedIndex.value]);
console.log(currentClip.value);
</script>

<template>
  <div class="flex flex-col gap-5 mt-5" v-if="currentClip">
    <div class="flex flex-row gap-5 items-center">
      <p class="text-2xl">{{ currentClip.count }}</p>
      <select v-model="selectedIndex" class="p-2 rounded-lg hover:cursor-pointer">
      <option v-for="(clip, index) in props.clipBatch" :value="index">
        {{ new Date(clip.time * 1000).toLocaleString() }}
        ({{ clip.count }})
      </option>
    </select>

    </div>
    <TwitchClip :clipId="currentClip.clip_id" />

  </div>
</template>
