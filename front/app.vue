<script lang="ts" setup>

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
const clickedUnixSeconds = ref(Date.now() / 1000);
const lineChart = ref();

const url = computed(() => `https://nljokeval-production.up.railway.app/api/${series_calc.value}?span=${span.value}&grouping=${grouping.value}&time=${currentTime.value}`);

const {
    data
} = await useFetch<SeriesData[]>(url);
const keys = computed(() => data.value && data.value.length > 0 && Object.keys(data.value?.[0]).filter(k => k !== "time") || ([] as string[]));
const selectedKeys = ref(new Set(["twos"]))
const nuxtApp = useNuxtApp();
const Chart = nuxtApp.$Chart;

const seriesColors = {
    twos: "#7cb5ec",
    lol: "#434348",
    cereal: "#90ed7d",
    monkas: "#f7a35c",
    joel: "#8085e9",
    pogs: "#f15c80",
    huhs: "#e4d354",
};

// "#2b908f",
//   "#f45b5b",
//   "#91e8e1",



const chartOptions = computed((): Highcharts.Options => ({
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
        height: 600,
        zooming: {
            type: "x",
        },
        events: {
            click: function (e: any) {
                const xVal = e?.xAxis?.[0]?.value;
                if (xVal) {
                    clickedUnixSeconds.value = Math.round(xVal / 1000);
                }
            },
        },
    },
    title: {
        text: "",
    },
    xAxis: {
        type: "datetime",
        title: {
            text: "Time",
        },
        labels: {
            formatter: function (x) {
                return new Date(x.value).toLocaleString();
            },
        },
    },
    yAxis: {
        title: {
            text: "Count",
        },
    },
    //@ts-ignore
    series: [...selectedKeys.value].map((key) => ({
        name: key,
        data: data.value?.map((d) => [d.time * 1000, d[key as keyof SeriesData]]),
        color: seriesColors[key as keyof typeof seriesColors],
        events: {
            click: function (e: any) {
                clickedUnixSeconds.value = e.point.x / 1000;
            },
        },
    })) || ([] as Highcharts.SeriesOptionsType[]),
}));

function handleSeriesButton(key: string) {
    if (selectedKeys.value.has(key)) {
        selectedKeys.value.delete(key);
    } else {
        selectedKeys.value.add(key);
    }
}
setInterval(() => {
    currentTime.value = new Date().getTime();
}, 10000);
</script>

<template>
    <div class="flex-row">
        <label for="calc">Calc</label>
        <select v-model="series_calc" id="calc">
            <option value="rolling_sum">rolling_sum</option>
            <option value="instant">instant</option>
        </select>
        <label for="past">Past</label>
        <select v-model="span" id="past">
            <option value="1 minute">1 minute</option>
            <option value="5 minutes">5 minutes</option>
            <option value="30 minutes">30 minutes</option>
            <option value="1 hour">1 hour</option>
            <option value="1 day">1 day</option>
            <option value="1 week">1 week</option>
            <option value="1 month">1 month</option>
            <option value="1 year">1 year</option>
        </select>
        <label for="grouping">Group by</label>
        <select v-model="grouping" id="grouping">
            <option value="second">second</option>
            <option value="minute">minute</option>
            <option value="hour">hour</option>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
            <option value="year">year</option>
        </select>

        <button v-for="key in keys" @click="() => handleSeriesButton(key)"
            :class="{ faded: !selectedKeys.has(key), 'series-button': true }"
            :style="{ backgroundColor: seriesColors[key as keyof typeof seriesColors] }">
        {{ key }}
        </button>
    </div>
    <Chart :options="chartOptions" ref="lineChart" />
    <ClipViewer :time="clickedUnixSeconds" />
</template>

<style>
.faded {
    opacity: 0.5;
}

.series-button {
    padding: 5px;
    background-color: white;
}

.flex-row {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: center;
}
</style>