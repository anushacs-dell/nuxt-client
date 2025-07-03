import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLangStore = defineStore('lang', () => {
  const preferredLanguage = ref('en')

  if (process.client) {
    const stored = localStorage.getItem('preferredLanguage')
    if (stored) preferredLanguage.value = stored

    watch(preferredLanguage, (lang) => {
      localStorage.setItem('preferredLanguage', lang)
    })
  }

  return { preferredLanguage }
})
