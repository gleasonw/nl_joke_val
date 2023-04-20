<script lang="ts" setup>
type ClipData = {
    clip_id: string;
    time: number;
}
const props = defineProps({
    time: Number
})
const parent = ref('');
onMounted(() => {
    parent.value = window.location.hostname;
})

const {
    data
} = await useFetch<ClipData>(computed(() => `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`));
const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${data.value?.clip_id}&parent=${parent.value}`);
console.log(data.value);

</script>

<template>
    <h2>Click on graph to pull nearest clip</h2>
    <p v-if="data && data.time > 0">{{ new Date(data.time * 1000).toLocaleString() }}</p>
    <iframe :src="vidSource" v-if="vidSource && parent" frameborder="0" allowfullscreen="true" scrolling="no" height="378"
        width="620" />
</template>
