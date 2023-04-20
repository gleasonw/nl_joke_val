import {Chart} from 'highcharts-vue'


export default defineNuxtPlugin(nuxtApp => {
    return nuxtApp.provide('Chart', Chart)
    // Doing something with nuxtApp
})
  