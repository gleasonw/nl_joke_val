/**
 * v0 by Vercel.
 * @see https://v0.dev/t/8KVU0QNkMxH
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Button } from "@/components/ui/button";
import { ResponsiveLine } from "@nivo/line";
import { CardTitle, CardHeader, CardContent, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { ResponsiveBar } from "@nivo/bar";

export default function Component() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center py-4">
        <div className="flex items-center space-x-4">
          <CircleDashedIcon className="text-gray-500" />
          <span className="text-sm text-gray-700">-0.83%</span>
        </div>
        <div className="flex items-center space-x-4">
          <CandlestickChartIcon className="text-gray-500" />
          <span className="text-sm text-gray-700">-0.26%</span>
        </div>
        <div className="flex items-center space-x-4">
          <CandlestickChartIcon className="text-gray-500" />
          <span className="text-sm text-gray-700">+0.045%</span>
        </div>
        <div className="flex items-center space-x-4">
          <TriangleIcon className="text-gray-500" />
          <span className="text-sm text-gray-700">+0.64%</span>
        </div>
        <div className="flex items-center space-x-4">
          <CandlestickChartIcon className="text-gray-500" />
          <span className="text-sm text-gray-700">+0.27%</span>
        </div>
      </div>
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Qualcomm Inc</h1>
          <div className="flex space-x-2">
            <Button variant="outline">Follow</Button>
            <Button variant="outline">
              <ShareIcon className="text-gray-500" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row lg:space-x-6">
          <div className="flex-1">
            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-bold">$167.89</span>
              <span className="text-lg font-semibold text-green-600">
                +3.99%
              </span>
              <span className="text-lg font-semibold text-green-600">
                +6.44 Today
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Pre-market: $168.99 (+0.66%) +1.10
            </p>
            <p className="text-sm text-gray-600">
              Closed: Mar 7, 5:25:57 AM UTC-5 · USD · NASDAQ · Disclaimer
            </p>
            <div className="flex space-x-4 py-4">
              <Button variant="outline">1D</Button>
              <Button variant="outline">5D</Button>
              <Button variant="outline">1M</Button>
              <Button variant="outline">6M</Button>
              <Button variant="outline">YTD</Button>
              <Button variant="outline">1Y</Button>
              <Button variant="outline">5Y</Button>
              <Button variant="outline">MAX</Button>
            </div>
            <LineChart className="w-full h-[300px]" />
          </div>
          <div className="flex flex-col space-y-4">
            <Card className="w-[350px]">
              <CardHeader>
                <CardTitle>Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold">PREVIOUS CLOSE</div>
                    <div className="text-sm">$161.45</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">DAY RANGE</div>
                    <div className="text-sm">$164.33 - $169.25</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">YEAR RANGE</div>
                    <div className="text-sm">$101.47 - $169.25</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">MARKET CAP</div>
                    <div className="text-sm">187.37B USD</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">AVG VOLUME</div>
                    <div className="text-sm">9.77M</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">P/E RATIO</div>
                    <div className="text-sm">24.33</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">DIVIDEND YIELD</div>
                    <div className="text-sm">1.91%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="flex flex-col space-y-2">
            <Input placeholder="Compare to" />
            <div className="grid grid-cols-2 gap-4">
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">NVIDIA Corp</div>
                  <div className="text-lg font-bold">$887.00</div>
                  <Badge variant="secondary">+3.18%</Badge>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">Microsoft Corp</div>
                  <div className="text-lg font-bold">$402.09</div>
                  <Badge variant="default">-0.14%</Badge>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">Plug Power Inc</div>
                  <div className="text-lg font-bold">$4.02</div>
                  <Badge variant="secondary">+10.74%</Badge>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">Apple Inc</div>
                  <div className="text-lg font-bold">$169.12</div>
                  <Badge variant="default">-0.59%</Badge>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">Broadcom Inc</div>
                  <div className="text-lg font-bold">$1,350.00</div>
                  <Badge variant="secondary">+0.54%</Badge>
                </CardContent>
              </Card>
              <Card className="col-span-1">
                <CardContent>
                  <div className="text-sm font-semibold">Intel Corp</div>
                  <div className="text-lg font-bold">$44.51</div>
                  <Badge variant="secondary">+3%</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Financials</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs>
                  <Button variant="ghost">Quarterly</Button>
                  <Button variant="ghost">Annual</Button>
                </Tabs>
                <BarChart className="w-full h-[300px]" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarChart(props) {
  return (
    <div {...props}>
      <ResponsiveBar
        data={[
          { name: "Jan", count: 111 },
          { name: "Feb", count: 157 },
          { name: "Mar", count: 129 },
          { name: "Apr", count: 150 },
          { name: "May", count: 119 },
          { name: "Jun", count: 72 },
        ]}
        keys={["count"]}
        indexBy="name"
        margin={{ top: 0, right: 0, bottom: 40, left: 40 }}
        padding={0.3}
        colors={["#2563eb"]}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickValues: 4,
          tickPadding: 16,
        }}
        gridYValues={4}
        theme={{
          tooltip: {
            chip: {
              borderRadius: "9999px",
            },
            container: {
              fontSize: "12px",
              textTransform: "capitalize",
              borderRadius: "6px",
            },
          },
          grid: {
            line: {
              stroke: "#f3f4f6",
            },
          },
        }}
        tooltipLabel={({ id }) => `${id}`}
        enableLabel={false}
        role="application"
        ariaLabel="A bar chart showing data"
      />
    </div>
  );
}

function CandlestickChartIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5v4" />
      <rect width="4" height="6" x="7" y="9" rx="1" />
      <path d="M9 15v2" />
      <path d="M17 3v2" />
      <rect width="4" height="8" x="15" y="5" rx="1" />
      <path d="M17 13v3" />
      <path d="M3 3v18h18" />
    </svg>
  );
}

function CircleDashedIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0" />
      <path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7" />
      <path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8" />
      <path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69" />
      <path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0" />
      <path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7" />
      <path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8" />
      <path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69" />
    </svg>
  );
}

function LineChart(props) {
  return (
    <div {...props}>
      <ResponsiveLine
        data={[
          {
            id: "Desktop",
            data: [
              { x: "Jan", y: 43 },
              { x: "Feb", y: 137 },
              { x: "Mar", y: 61 },
              { x: "Apr", y: 145 },
              { x: "May", y: 26 },
              { x: "Jun", y: 154 },
            ],
          },
          {
            id: "Mobile",
            data: [
              { x: "Jan", y: 60 },
              { x: "Feb", y: 48 },
              { x: "Mar", y: 177 },
              { x: "Apr", y: 78 },
              { x: "May", y: 96 },
              { x: "Jun", y: 204 },
            ],
          },
        ]}
        margin={{ top: 10, right: 10, bottom: 40, left: 40 }}
        xScale={{
          type: "point",
        }}
        yScale={{
          type: "linear",
        }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 16,
        }}
        axisLeft={{
          tickSize: 0,
          tickValues: 5,
          tickPadding: 16,
        }}
        colors={["#2563eb", "#e11d48"]}
        pointSize={6}
        useMesh={true}
        gridYValues={6}
        theme={{
          tooltip: {
            chip: {
              borderRadius: "9999px",
            },
            container: {
              fontSize: "12px",
              textTransform: "capitalize",
              borderRadius: "6px",
            },
          },
          grid: {
            line: {
              stroke: "#f3f4f6",
            },
          },
        }}
        role="application"
      />
    </div>
  );
}

function ShareIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </svg>
  );
}

function TriangleIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    </svg>
  );
}
