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
  x: number;
  y: number;
}

const series_calc = ref<'rolling_sum' | 'instant'>('rolling_sum');
const span = ref<'1 minute' | '5 minutes' | '30 minutes' | '1 hour' | '1 day' | '1 week' | '1 month' | '1 year'>('5 minutes');
const grouping = ref<'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'>('second');

const url = computed(() => `http://localhost:8080/api/${series_calc.value}?span=${span.value}&grouping=${grouping.value}`);

const { data, refresh } = await useFetch<SeriesData[]>(url);

// every 5 seconds, refresh the data
setInterval(() => {
  refresh();
}, 5000);
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
    labels: data.map(d => (new Date(d.x * 1000)).toUTCString()),
    datasets: [{
      backgroundColor: '#f87979',
      label: 'test',
      data,
    }]
  }" />
</template>
