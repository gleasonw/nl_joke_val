<script setup>
const props = defineProps({
  clipId: String,
});
const parent = ref("");
onMounted(() => {
  parent.value = window.location.hostname;
});
const vidSource = computed(
  () =>
    `https://clips.twitch.tv/embed?clip=${props.clipId}&parent=${parent.value}`
);
</script>

<template>
  <iframe
    :src="vidSource"
    v-if="vidSource && parent"
    frameborder="0"
    allowfullscreen="true"
    scrolling="no"
    height="378"
    width="620"
    class="twitch-clip"
  />
</template>

<style>
/* Default styles for Twitch clip iframe */
.twitch-clip {
  width: 620;
  height: 378px; /* Default height */
}

/* Media query for screens smaller than 768px */
@media (max-width: 767px) {
  .twitch-clip {
    height: 200px; /* Adjust height for mobile screens */
    width: 310px;
  }
}
</style>
