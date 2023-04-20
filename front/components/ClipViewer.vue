<script lang="ts" setup>
type ClipData = {
    clip_id: string;
    time: number;
}
const props = defineProps({
    time: Number
})
const {
    data
} = await useFetch<ClipData>(computed(() => `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`));

</script>

<template>
    <div>
        <h2>Click on graph to pull nearest clip</h2>
        <p v-if="data && data.time > 0">{{ new Date(data.time * 1000).toLocaleString() }}</p>
        <TwitchClip v-if="data" :clipId="data.clip_id" />
    </div>
</template>
