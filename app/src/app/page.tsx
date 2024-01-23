import Head from "next/head";
import Dashboard from "@/app/dashboard";

export default async function Home() {
  return (
    <div>
      <Head>
        <title>NL Chat Dashboard</title>
      </Head>
      <Dashboard />
    </div>
  );
}
