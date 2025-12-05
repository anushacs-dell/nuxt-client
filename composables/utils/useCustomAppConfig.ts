import { ref } from 'vue'

const appTitle = ref('ZOO-Project')

export function useCustomAppConfig() {
  return {
    appTitle
  }
}
