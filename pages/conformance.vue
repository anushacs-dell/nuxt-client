<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12" style="max-width: 800px;">
        <p class="text-h4 q-mb-md text-weight-bold">{{ t('Conformance Classes') }}</p>

        <q-card class="q-pa-md shadow-2 rounded-borders">
          <q-card-section>
            <p class="text-body1 q-mb-md">
              {{ t('Below are the supported conformance classes for this API:') }}
            </p>
            <q-list bordered separator>
              <q-item
                v-for="(link, index) in conformanceLinks"
                :key="index"
                clickable
                tag="a"
                :href="link"
                target="_blank"
              >
                <q-item-section>{{ link }}</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRuntimeConfig } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useI18n } from 'vue-i18n'

const conformanceLinks = ref([])
const config = useRuntimeConfig()
const authStore = useAuthStore()
const { locale, t } = useI18n()


onMounted(async () => {
  try {
    const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/conformance`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    const data = await response.json()
    conformanceLinks.value = data.conformsTo || []
  } catch (error) {
    console.error('Error fetching conformance classes:', error)
  }
})
</script>
