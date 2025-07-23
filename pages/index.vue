<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12" style="max-width: 900px;">

        <p class="text-h4 q-mb-md text-weight-bold">Home</p>

        <q-card v-if="apiInfo" class="q-pa-md q-mb-lg">
          <q-card-section>
            <div class="text-h6">{{ apiInfo.title }}</div>
            <div class="text-subtitle2">Version: {{ apiInfo.version }}</div>
            <div class="q-mt-sm">{{ apiInfo.description }}</div>

            <div class="q-mt-sm">
              Contact: {{ apiInfo.contact?.name }} ({{ apiInfo.contact?.email }})
            </div>

            <div class="q-mt-sm" v-if="apiInfo.license">
              License:
              <a
                :href="apiInfo.license.url"
                target="_blank"
                class="text-primary"
                style="text-decoration: underline"
              >
                {{ apiInfo.license.name }}
              </a>
            </div>

            <div class="q-mt-md" v-if="apiInfo['x-keywords']">
              <div class="text-subtitle2 q-mb-xs">Keywords:</div>
              <q-chip
                v-for="(kw, i) in apiInfo['x-keywords']"
                :key="i"
                color="primary"
                text-color="white"
                class="q-mr-sm"
                dense
              >
                {{ kw }}
              </q-chip>
            </div>

            <div class="q-mt-md" v-if="apiInfo['x-ows-servicecontact']">
              <div class="text-subtitle2 q-mb-xs">Service Contact:</div>
              <div class="q-mt-sm">Name: {{ apiInfo['x-ows-servicecontact'].individualName }}</div>
              <div class="q-mt-sm">Organization: {{ apiInfo['x-ows-servicecontact'].providerName }}</div>
              <div class="q-mt-sm">
                Email:
                <a :href="`mailto:${apiInfo['x-ows-servicecontact'].addressElectronicMailAddress}`"
                   class="text-primary">
                  {{ apiInfo['x-ows-servicecontact'].addressElectronicMailAddress }}
                </a>
              </div>
              <div class="q-mt-sm">
                Address:
                {{ apiInfo['x-ows-servicecontact'].addressDeliveryPoint }},
                {{ apiInfo['x-ows-servicecontact'].addressCity }} -
                {{ apiInfo['x-ows-servicecontact'].addressPostalCode }},
                {{ apiInfo['x-ows-servicecontact'].addressCountry }}
              </div>
            </div>
          </q-card-section>
        </q-card>

              <q-card v-if="landingLinks.length" class="q-pa-md q-mb-md">
          <q-card-section>
            <div class="text-h6">Available Links</div>

            <div v-for="(links, title) in groupedLinks" :key="title" class="q-mb-md">
              <div class="text-subtitle1 q-mb-xs">{{ title }}</div>
              <q-list separator>
                <q-item
                  v-for="(link, idx) in links"
                  :key="idx"
                  clickable
                  tag="a"
                  :href="link.href"
                  target="_blank"
                  class="hoverable-link text-primary"
                >
                <q-item-section>
                  {{ getReadableLinkText(link) }}
                </q-item-section>

                </q-item>
              </q-list>
            </div>
          </q-card-section>
        </q-card>

        <q-spinner v-if="loading" class="q-mt-lg" />
      </div>
    </div>
  </q-page>
</template>


<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRuntimeConfig } from '#imports'

const authStore = useAuthStore()
const landingLinks = ref<any[]>([])
const apiInfo = ref<any>(null)
const loading = ref(false)
const config = useRuntimeConfig()

const landingUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/`
const apiSpecUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/api`

const fetchLandingAndApiInfo = async () => {
  loading.value = true
  try {
    const landingRes = await $fetch(landingUrl, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`
      }
    })
    landingLinks.value = landingRes.links || []

    const apiRes = await $fetch(apiSpecUrl)
    apiInfo.value = apiRes.info || {}
  } catch (err) {
    console.error('Error loading homepage data:', err)
    const landingRes = await $fetch(landingUrl)
    landingLinks.value = landingRes.links || []

    const apiRes = await $fetch(apiSpecUrl)
    apiInfo.value = apiRes.info || {}
  } finally {
    loading.value = false
  }
}

const groupedLinks = computed(() => {
  const groups: Record<string, any[]> = {}

  for (const link of landingLinks.value) {
    const title = link.title || 'Untitled'
    if (!groups[title]) {
      groups[title] = []
    }
    groups[title].push(link)
  }

  return groups
})

const getReadableLinkText = (link: any): string => {
  const href = link.href || ''

  if (href.endsWith('/ogc-api/')) return 'View this document in JSON.'
  if (href.endsWith('/ogc-api/index.html')) return 'View the alternative version in HTML.'
  if (href.endsWith('/ogc-api/api')) return 'View the service description.'
  if (href.endsWith('/ogc-api/api.html')) return 'View service documentation.'
  if (href.endsWith('/ogc-api/conformance')) return 'View the conformance classes that the link\'s context conforms to.'
  if (href.endsWith('/ogc-api/conformance.html')) return 'View the alternative version in HTML.'
  if (href.endsWith('/ogc-api/processes')) return 'View the list of processes the API offers.'
  if (href.endsWith('/ogc-api/processes.html')) return 'View the alternative version in HTML.'
  if (href.endsWith('/ogc-api/jobs')) return 'View the list of job available on this server.'
  if (href.endsWith('/ogc-api/jobs.html')) return 'View the alternative version in HTML.'

  return 'View link'
}



onMounted(fetchLandingAndApiInfo)
</script>