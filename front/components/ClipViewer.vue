<script lang="ts" setup>
const props = defineProps({
    time: Number
})
const parent = ref('');
onMounted(() => {
    parent.value = window.location.hostname;
})

const {
    data
} = await useFetch(computed(() => `https://nljokeval-production.up.railway.app/api/clip?time=${props.time}`));

const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${data.value}&parent=${parent.value}`);
</script>

<template>
<iframe :src="vidSource" v-if="vidSource && parent" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620" />
</template>
