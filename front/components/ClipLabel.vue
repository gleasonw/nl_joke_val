<script lang="ts" setup>
import { Clip } from "./CustomClip.vue";

const props = defineProps<{ clip_batch?: Clip[] }>();
const selectedIndex = ref(0);
const currentClip = computed(() => props.clip_batch?.[selectedIndex.value]);
</script>

<template>
  <div class="flex flex-col gap-5 mt-5" v-if="currentClip">
    <p>
      {{ new Date(currentClip.time * 1000).toLocaleString() }}
    </p>
    <p class="text-xl">
      {{ currentClip.count }}
    </p>
    <TwitchClip :clipId="currentClip.clip_id" />
    <select v-model="selectedIndex" class="p-2 rounded-lg hover:cursor-pointer">
      <option v-for="(clip, index) in props.clip_batch" :value="index">
        {{ new Date(currentClip.time * 1000).toLocaleString() }}
        ({{ clip.count }})
      </option>
    </select>
  </div>
</template>
