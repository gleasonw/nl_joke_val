import App from "@/components/App";
import Head from "next/head";

export default function Home() {
  return (
    <div>
      <Head>
        <title>NL Chat Dashboard</title>
        <meta name="description" content="NL Chat Dashboard" />
      </Head>
      <App />
    </div>
  );
}
