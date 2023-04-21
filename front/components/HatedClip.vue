<script lang="ts" setup>
type MinClipData = {
    clip_id: string;
    time: number;
    twos: number;
}

const {
    data
} = await useFetch<MinClipData>(`https://nljokeval-production.up.railway.app/api/min_clip`);
console.log(data.value);

</script>

<template>
    <div>
        <h2>Low score (10s)</h2>
        <p><i>Let them eat cake</i></p>
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
