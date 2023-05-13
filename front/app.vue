<script lang="ts">
export enum SeriesKeys {
  two = "two",
  lol = "lol",
  cereal = "cereal",
  monkas = "monkas",
  joel = "joel",
  pog = "pog",
  huh = "huh",
  no = "no",
  cocka = "cocka",
  shock = "shock",
  who_asked = "who_asked",
  copium = "copium",
}
export const seriesColors: Record<SeriesKeys, string> = {
  [SeriesKeys.two]: "#7cb5ec",
  [SeriesKeys.lol]: "#434348",
  [SeriesKeys.cereal]: "#90ed7d",
  [SeriesKeys.monkas]: "#f7a35c",
  [SeriesKeys.joel]: "#8085e9",
  [SeriesKeys.pog]: "#f15c80",
  [SeriesKeys.huh]: "#e4d354",
  [SeriesKeys.no]: "#2b908f",
  [SeriesKeys.cocka]: "#f45b5b",
  [SeriesKeys.shock]: "#8d4654",
  [SeriesKeys.who_asked]: "#91e8e1",
  [SeriesKeys.copium]: "#696969",
};
</script>

<script lang="ts" setup>
import { Chart } from "highcharts-vue";
import { z } from "zod";
const SeriesDataSchema = z.object({
  [SeriesKeys.two]: z.number(),
  [SeriesKeys.lol]: z.number(),
  [SeriesKeys.cereal]: z.number(),
  [SeriesKeys.monkas]: z.number(),
  [SeriesKeys.joel]: z.number(),
  [SeriesKeys.pog]: z.number(),
  [SeriesKeys.huh]: z.number(),
  [SeriesKeys.no]: z.number(),
  [SeriesKeys.cocka]: z.number(),
  [SeriesKeys.shock]: z.number(),
  [SeriesKeys.who_asked]: z.number(),
  [SeriesKeys.copium]: z.number(),
  time: z.number(),
});
const SeriesData = SeriesDataSchema.array();

const series_calc = ref<"rolling_sum" | "instant">("instant");
const span = ref<
  | "1 minute"
  | "5 minutes"
  | "30 minutes"
  | "1 hour"
  | "9 hours"
  | "1 day"
  | "1 week"
  | "1 month"
  | "1 year"
>("1 hour");
const grouping = ref<
  "second" | "minute" | "hour" | "day" | "week" | "month" | "year"
>("second");
const display = ref<"line" | "bar">("line");
const currentTime = ref(new Date().getTime());
const clickedUnixSeconds = ref(Date.now() / 1000);
const lineChart = ref();

const url = computed(
  () =>
    `https://nljokeval-production.up.railway.app/api/${series_calc.value}?span=${span.value}&grouping=${grouping.value}&time=${currentTime.value}`
);

const { data } = await useFetch(url);
const unpackedSeries = computed(() => {
  const result = SeriesData.safeParse(data.value);
  if (!result.success) {
    console.error(result.error);
    throw new Error("Failed to parse data");
  }
  return result.data;
});
const keys = computed(
  () =>
    (unpackedSeries.value &&
      unpackedSeries.value.length > 0 &&
      Object.keys(unpackedSeries.value?.[0]).filter((k) => k !== "time")) ||
    ([] as string[])
);
const selectedKeys = ref(new Set(["two"]));
const chartOptions = computed(
  (): Highcharts.Options => ({
    dateTimeLabelFormats: {
      millisecond: "%I:%M:%S.%L",
      second: "%I:%M:%S",
      minute: "%I:%M",
      hour: "%I:%M",
      day: "%e. %b",
      week: "%e. %b",
      month: "%b '%y",
      year: "%Y",
    },
    time: {
      getTimezoneOffset: function (timestamp: number) {
        if (grouping.value === "day") {
          // using an offset would throw off the day grouping
          return 0;
        }
        return new Date(timestamp).getTimezoneOffset();
      },
    },
    plotOptions: {
      series: {
        marker: {
          enabled: false,
        },
      },
      line: {
        linecap: "round",
      },
    },
    chart: {
      type: display.value,
      height: 600,
      zooming: {
        type: "x",
      },
      events: {
        click: function (e: any) {
          let xVal = e?.xAxis?.[0]?.value;
          if (xVal) {
            clickedUnixSeconds.value = xVal / 1000;
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
    },
    yAxis: {
      title: {
        text: "Count",
      },
    },
    //@ts-ignore
    series:
      [...selectedKeys.value].map((key) => ({
        name: key,
        data: unpackedSeries.value?.map((d) => [
          d.time * 1000,
          d[key as keyof typeof d],
        ]),
        color: seriesColors[key as keyof typeof seriesColors],
        events: {
          click: function (e: any) {
            clickedUnixSeconds.value = e.point.x / 1000;
          },
        },
      })) || ([] as Highcharts.SeriesOptionsType[]),
  })
);

function handleSeriesButton(key: string) {
  if (selectedKeys.value.has(key)) {
    selectedKeys.value.delete(key);
  } else {
    selectedKeys.value.add(key);
  }
}

function handleSpanChange(e: any) {
  const newSpan = e.target.value;
  if (newSpan === "1 week" || newSpan === "1 month" || newSpan === "1 year") {
    grouping.value = "day";
  }
  span.value = newSpan;
}

setInterval(() => {
  currentTime.value = new Date().getTime();
}, 10000);
</script>

<template>
  <div class="mb-10">
    <div class="m-5 flex-col gap-8 flex items-center justify-center">
      <div class="flex-row flex gap-4 items-center flex-wrap">
        <label for="calc">Calc</label>
        <select
          v-model="series_calc"
          id="calc"
          class="p-2 rounded-lg hover:cursor-pointer"
        >
          <option value="rolling_sum">rolling_sum</option>
          <option value="instant">instant</option>
        </select>
        <label for="past">Past</label>
        <select
          :value="span"
          @input="handleSpanChange"
          id="past"
          class="p-2 rounded-lg hover:cursor-pointer"
        >
          <option>1 minute</option>
          <option>5 minutes</option>
          <option>30 minutes</option>
          <option>1 hour</option>
          <option>9 hours</option>
          <option>1 day</option>
          <option>1 week</option>
          <option>1 month</option>
          <option>1 year</option>
        </select>
        <label for="grouping">Group by</label>
        <select
          v-model="grouping"
          id="grouping"
          class="p-2 rounded-lg hover:cursor-pointer"
        >
          <option>second</option>
          <option>minute</option>
          <option>hour</option>
          <option>day</option>
          <option>week</option>
          <option>month</option>
          <option>year</option>
        </select>
        <label for="display">Display</label>
        <select
          v-model="display"
          id="display"
          class="p-2 rounded-lg hover:cursor-pointer"
        >
          <option value="bar">bar</option>
          <option value="line">line</option>
        </select>
      </div>
      <div class="flex-row gap-5 flex flex-wrap">
        <button
          v-for="key in keys"
          @click="() => handleSeriesButton(key)"
          class="rounded-lg p-2 hover:cursor-pointer"
          :class="{ faded: !selectedKeys.has(key), 'series-button': true }"
          :style="{ backgroundColor: seriesColors[key as keyof typeof seriesColors] }"
        >
          {{ key }}
        </button>
      </div>
    </div>
    <Chart :options="chartOptions" ref="lineChart" />
    <div class="flex-col flex justify-center gap-16">
      <div class="flex flex-row gap-20 flex-wrap justify-center">
        <ClipViewer :time="clickedUnixSeconds" />
        <CustomClip />
        <HatedClip />
      </div>
    </div>
  </div>
</template>

<style>
.faded {
  opacity: 0.5;
}
</style>
