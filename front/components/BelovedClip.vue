<script lang="ts" setup>
type MaxClipData = {
    clip_id: string;
    time: number;
    twos: number;
}

const {
    data
} = await useFetch<MaxClipData>(`https://nljokeval-production.up.railway.app/api/max_clip`);

</script>

<template>
    <div>
        <h2>The King</h2>
        <p><i>highest 10s</i></p>
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