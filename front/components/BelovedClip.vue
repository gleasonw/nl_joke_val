<script lang="ts" setup>
type MaxClipData = {
    clip_id: string;
    time: number;
    twos: number;
}

const {
    data
} = await useFetch<MaxClipData>(`https://nljokeval-production.up.railway.app/api/max_clip?column=twos`);

</script>

<template>
    <div class="flex flex-col gap-2">
        <h2 class="font-bold text-2xl">High score (10s)</h2>
        <p><i>Bread and circuses</i></p>
        <ClipLabel v-if="data" :data="data" />
    </div>
</template>