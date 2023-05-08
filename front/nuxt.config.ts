// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  modules: ["@nuxtjs/tailwindcss"],
  plugins: [{ src: "~/plugins/vercel.client.ts", mode: "client" }],
});
