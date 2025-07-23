import { defineStore } from 'pinia'
import { useCookie } from '#app'

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    currentLayout: useCookie('selected_layout').value || 'Default'
  }),
  actions: {
    setLayout(layout: string) {
      this.currentLayout = layout
      useCookie('selected_layout').value = layout
    }
  }
})
