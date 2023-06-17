"use client";

import {
  Grid,
  Col,
  Title,
  TabGroup,
  TabList,
  Tab,
  Text,
  Flex,
  Select,
  SelectItem,
  MultiSelect,
  MultiSelectItem,
  Card,
  Metric,
  LineChart,
  BarChart,
} from "@tremor/react";
import { useState } from "react";

export default function Dashboard(props: any) {
  enum SeriesKeys {
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

  const seriesColors: Record<SeriesKeys, string> = {
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

  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [functionType, setFunctionType] = useState<
    "rolling-sum" | "instantaneous"
  >("instantaneous");
  const [series, setSeries] = useState<SeriesKeys[]>([SeriesKeys.two]);
  const [timeSpan, setTimeSpan] = useState<
    "1M" | "1H" | "9H" | "1D" | "1W" | "1M" | "6M" | "YTD" | "Max"
  >("1M");

  return (
    <Grid numItems={1} numItemsLg={3} className="gap-2">
      <Col numColSpan={1} numColSpanLg={2}>
        <Title>The Live NL Joke Monitor</Title>\
        <TabGroup>
          <TabList>
            <Tab>1M</Tab>
            <Tab>1H</Tab>
            <Tab>9H</Tab>
            <Tab>1D</Tab>
            <Tab>1W</Tab>
            <Tab>1M</Tab>
            <Tab>6M</Tab>
            <Tab>YTD</Tab>
            <Tab>Max</Tab>
          </TabList>
        </TabGroup>
        <Flex>
          <Select>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="bar">Bar</SelectItem>
          </Select>
          <Select>
            <SelectItem value="rolling-sum">Rolling sum</SelectItem>
            <SelectItem value="instantaneous">Instantaneous</SelectItem>
          </Select>
          <MultiSelect>
            {Object.keys(SeriesKeys).map((series) => (
              <MultiSelectItem value={series}>{series}</MultiSelectItem>
            ))}
          </MultiSelect>
        </Flex>
        {chartType === "line" ? <LineChart /> : <BarChart />}
      </Col>
      <Card>
        <Text>Title</Text>
        <Metric>Related clips</Metric>
      </Card>
      <Card>
        <Text>+2</Text>
        <Metric>+2</Metric>
      </Card>
      <Card>
        <Text>-2</Text>
        <Metric>-2</Metric>
      </Card>
      <Card>
        <Text>All</Text>
        <Metric>All</Metric>
      </Card>
    </Grid>
  );
}
