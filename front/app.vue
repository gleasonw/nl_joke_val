<script lang="ts" setup>
import { Chart} from "highcharts-vue";



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

const series_calc = ref < 'rolling_sum' | 'instant' > ('instant');
const span = ref < '1 minute' | '5 minutes' | '30 minutes' | '1 hour' | '1 day' | '1 week' | '1 month' | '1 year' > ('30 minutes');
const grouping = ref < 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' > ('minute');
const currentTime = ref(new Date().getTime());
const clickedUnixSeconds = ref(Date.now() / 1000);
const lineChart = ref();

const url = computed(() => `https://nljokeval-production.up.railway.app/api/${series_calc.value}?span=${span.value}&grouping=${grouping.value}&time=${currentTime.value}`);

const {
    data
} = await useFetch < SeriesData[] > (url);

const chartOptions = computed(() => ({
    plotOptions: {
        series: {
            marker: {
                enabled: false,
            },
        },
        line: {
            linecap: "round",
        }
    },
    chart: {
        type: "line",
        zoomType: "x",
        events: {
            click: function (e: any) {
                const xVal = e?.xAxis?.[0]?.value;
                if(xVal) {
                    clickedUnixSeconds.value = Math.round(xVal / 1000);
                }
            },
        },
    },
    title: {
        text: "Joke Value",
    },
    xAxis: {
        type: "datetime",
        title: {
            text: "Time",
        },
    },
    yAxis: {
        title: {
            text: "Joke Value",
        },
    },
    series: data.value && data.value.length > 0 && Object.keys(data.value?.[0]).filter(k => k !== "time").map((key) => ({
        name: key,
        data: data.value?.map((d) => [d.time * 1000, d[key as keyof SeriesData]]),
        events: {
            click: function (e: any) {
                console.log(e.point.x);
                clickedUnixSeconds.value = e.point.x / 1000;
            },
        },
    })) || ([] as Highcharts.SeriesOptionsType[]),
}));

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
<Chart :options="chartOptions" ref="lineChart" />
<ClipViewer :time="clickedUnixSeconds" />
</template>
