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
const { data } = await useFetch<SeriesData[]>("https://nljokeval-production.up.railway.app/api/instant?span=1%20week&grouping=day")

const seriesColors = {
    twos: "#7cb5ec",
    lol: "#434348",
    cereal: "#90ed7d",
    monkas: "#f7a35c",
    joel: "#8085e9",
    pogs: "#f15c80",
    huhs: "#e4d354",
};

const keys = computed(() => data.value && data.value.length > 0 && Object.keys(data.value?.[0]).filter(k => k !== "time") || ([] as string[]));
console.log(keys.value)

const nuxtApp = useNuxtApp();
const Chart = nuxtApp.$Chart;

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
        type: "bar",
        height: 600,
    },
    title: {
        text: "",
    },
    xAxis: {
        type: "datetime",
        title: {
            text: "Day",
        },
        labels: {
            formatter: function (x) {
                return new Date(x.value).toLocaleDateString();
            },
        },
    },
    yAxis: {
        title: {
            text: "Count",
        },
    },
    //@ts-ignore
    series: keys.value?.map((key) => ({
        name: key,
        data: data.value?.map((d) => [d.time * 1000, d[key as keyof SeriesData]]),
        color: seriesColors[key as keyof typeof seriesColors],
    })) || ([] as Highcharts.SeriesOptionsType[]),
}));
</script>

<template>
    <div>
        <Chart :options="chartOptions" />
    </div>
</template>