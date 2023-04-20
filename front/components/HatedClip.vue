<script lang="ts" setup>
type MinClipData = {
    clip_id: string;
    time: number;
    twos: number;
}
const parent = ref('');
onMounted(() => {
    parent.value = window.location.hostname;
})

const {
    data
} = await useFetch<MinClipData>(`https://nljokeval-production.up.railway.app/api/min_clip`);
const vidSource = computed(() => `https://clips.twitch.tv/embed?clip=${data.value?.clip_id}&parent=${parent.value}`);
console.log(data.value);

</script>

<template>
    <div>
        <h2>The Tyrant</h2>
        <p v-if="data && data.time > 0">
        <p>
            {{ new Date(data.time * 1000).toLocaleString() }}
        </p>
        <p>
            {{ data.twos }}
        </p>
        </p>
        <iframe :src="vidSource" v-if="vidSource && parent" frameborder="0" allowfullscreen="true" scrolling="no"
            height="378" width="620" />

    </div>
</template>
