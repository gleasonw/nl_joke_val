<script lang="ts" setup>
import {seriesColors} from "../app.vue";
type MaxClipData = {
    clip_id: string;
    time: number;
    twos: number;
}
const column = ref<keyof typeof seriesColors>('lol');
const {
    data
} = await useFetch<MaxClipData>(computed(() => `https://nljokeval-production.up.railway.app/api/max_clip?column=${column.value}`));

</script>

<template>
    <div>
        <h2>Emote (10s)</h2>
        <select v-model="column">
            <option v-for="key in Object.keys(seriesColors)" :value="key">{{ key }}</option>
        </select>
        <p v-if="data && data.time > 0">
        <p>
            {{ new Date(data.time * 1000).toLocaleString() }}
        </p>
        <p>
            {{ data.twos }}
        </p>
        </p>
        <TwitchClip v-if="data" :clipId="data.clip_id" />
    </div>
</template>