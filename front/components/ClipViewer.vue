<script lang="ts" setup>
const props = defineProps({
    time: Number
})

const {
    data
} = await useFetch(computed(() => `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`));

const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${data.value}&parent=localhost`);
</script>

<template>
<iframe :src="vidSource" v-if="vidSource" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620" />
</template>
