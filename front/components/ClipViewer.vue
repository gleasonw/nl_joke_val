<script lang="ts" setup>
const props = defineProps({time: Number})
const clipIDurl = computed(() => `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`);
const { data } = await useFetch(clipIDurl);
const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${data.value}&parent=http://localhost:3000`);
</script>

<template>
    <iframe :src="vidSource" v-if="vidSource" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620"/>
</template>