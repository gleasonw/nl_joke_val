<script setup>
const props = defineProps({
    clipId: String
})
const parent = ref('');
onMounted(() => {
    parent.value = window.location.hostname;
})
const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${props.clipId}&parent=${parent.value}`);


</script>

<template>

<iframe :src="vidSource" v-if="vidSource && parent" frameborder="0" allowfullscreen="true" scrolling="no"
            height="378" width="620" />
</template>