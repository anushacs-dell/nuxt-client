import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRuntimeConfig } from '#imports'

const landingLinks = ref<any[]>([]) // Keep this reactive and global
const fetched = ref(false)

export const useLandingLinks = () => {
  const { locale } = useI18n()
  const config = useRuntimeConfig()

  const fetchLinks = async () => {
    if (fetched.value) return // avoid duplicate calls

    try {
      const headers = { 'Accept-Language': locale.value }
      const res = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/`, { headers })
      landingLinks.value = res.links || []
      fetched.value = true
    } catch (err) {
      console.error('Error fetching links:', err)
    }
  }

  onMounted(fetchLinks) // fetch when any component uses it

  return {landingLinks}
}


