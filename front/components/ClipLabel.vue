<script lang="ts" setup>
import { Clip } from "./CustomClip.vue";

const props = defineProps<{ clipBatch: Clip[] }>();
const selectedIndex = ref(0);
console.log(props.clipBatch);
const currentClip = computed(() => props.clipBatch?.[selectedIndex.value]);
console.log(currentClip.value);
</script>

<template>
  <div class="flex flex-col gap-5 mt-5" v-if="currentClip">
    <p class="text-2xl text-center">
      {{ currentClip.count > 0 ? "+" : "" }} {{ currentClip.count }}
      <p class="text-lg italic">
        {{ new Date(currentClip.time * 1000).toLocaleString() }}

      </p>
    </p>

    <TwitchClip :clipId="currentClip.clip_id" />

    <div class="flex flex-row gap-5 items-center">
      <div class="p-2 rounded-lg flex flex-col w-full">
        <button
          v-for="(clip, index) in props.clipBatch"
          @click="() => (selectedIndex = index)"
          class="p-4 rounded-lg hover:cursor-pointer text-xl shadow-md hover:bg-zinc-100"
        >
          {{ new Date(clip.time * 1000).toLocaleString() }}
          ({{ clip.count }})
        </button>
      </div>
    </div>
  </div>
</template>
