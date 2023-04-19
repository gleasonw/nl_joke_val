<script lang="ts" setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'vue-chartjs'
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface SeriesData {
  twos: number;
  lol: number;
  cereal: number;
  monkas: number;
  joel: number;
  pogs: number;
  huhs: number;
  time: number;
}

const series_calc = ref<'rolling_sum' | 'instant'>('instant');
const span = ref<'1 minute' | '5 minutes' | '30 minutes' | '1 hour' | '1 day' | '1 week' | '1 month' | '1 year'>('30 minutes');
const grouping = ref<'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'>('minute');
const currentTime = ref(new Date().getTime());

const url = computed(() => `https://nljokeval-production.up.railway.app/api/${series_calc.value}?span=${span.value}&grouping=${grouping.value}&time=${currentTime.value}`);

const { data } = await useFetch<SeriesData[]>(url);


const colors = {
  twos: "#7cb5ec",
  lol: "#434348",
  cereal: "#90ed7d",
  monkas: "#f7a35c",
  joel: "#8085e9",
  pogs: "#f15c80",
  huhs: "#e4d354",
}

setInterval(() => {
  currentTime.value = new Date().getTime();
}, 10000);
</script>

<template>
  <select v-model="series_calc">
    <option value="rolling_sum">rolling_sum</option>
    <option value="instant">instant</option>
  </select>
  <select v-model="span">
    <option value="1 minute">1 minute</option>
    <option value="5 minutes">5 minutes</option>
    <option value="30 minutes">30 minutes</option>
    <option value="1 hour">1 hour</option>
    <option value="1 day">1 day</option>
    <option value="1 week">1 week</option>
    <option value="1 month">1 month</option>
    <option value="1 year">1 year</option>
  </select>
  <select v-model="grouping">
    <option value="second">second</option>
    <option value="minute">minute</option>
    <option value="hour">hour</option>
    <option value="day">day</option>
    <option value="week">week</option>
    <option value="month">month</option>
    <option value="year">year</option>
  </select>

  <Line v-if="data" :data="{
    labels: data.map(d => (new Date(d.time * 1000)).toUTCString()),
    datasets: Object.keys(data[0]).filter(k => k !== 'time').map((k) => ({
      label: k,
      data: data?.map(d => d[k as keyof SeriesData]) ?? [],
      borderColor: colors[k as keyof typeof colors],
      fill: false,
      tension: 0.1
    }))
  }" />
</template>
