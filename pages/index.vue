<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12" style="max-width: 900px;">

        <p class="text-h4 q-mb-md text-weight-bold">{{ t('Home') }}</p>

        <!-- ✅ Help Button -->
        <q-btn
          flat
          icon="help_outline"
          color="primary"
          :label="t('Help')"
          @click="helpVisible = true"
          class="q-mb-md"
        />

        <!-- ✅ Help Dialog -->
        <HelpDialog
          v-model="helpVisible"
          title="Home Help"
          :help-content="helpContent"
        />

        <q-card v-if="apiInfo" class="q-pa-md q-mb-lg">
          <q-card-section>
            <div class="text-h6">{{ apiInfo.title }}</div>
            <div class="text-subtitle2">{{ t('Version') }}: {{ apiInfo.version }}</div>
            <div class="q-mt-sm">{{ apiInfo.description }}</div>

            <div class="q-mt-sm">
              {{ t('Contact') }}: {{ apiInfo.contact?.name }} ({{ apiInfo.contact?.email }})
            </div>

            <div class="q-mt-sm" v-if="apiInfo.license">
              {{ t('License') }}:
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
              <div class="text-subtitle2 q-mb-xs">{{ t('Keywords') }}:</div>
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
              <div class="text-subtitle2 q-mb-xs">{{ t('Service Contact') }}:</div>
              <div class="q-mt-sm">{{ t('Name') }}: {{ apiInfo['x-ows-servicecontact'].individualName }}</div>
              <div class="q-mt-sm">{{ t('Organization') }}: {{ apiInfo['x-ows-servicecontact'].providerName }}</div>
              <div class="q-mt-sm">
                {{ t('Email') }}:
                <a :href="`mailto:${apiInfo['x-ows-servicecontact'].addressElectronicMailAddress}`"
                   class="text-primary">
                  {{ apiInfo['x-ows-servicecontact'].addressElectronicMailAddress }}
                </a>
              </div>
              <div class="q-mt-sm">
                {{ t('Address') }}:
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
            <div class="text-h6">{{ t('Available Links') }}</div>

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
import { ref, onMounted, computed } from 'vue'
import { useRuntimeConfig } from '#imports'
import { useI18n } from 'vue-i18n'
import HelpDialog from '../components/help/HelpDialog.vue'
import HomepageHelp from '../components/help/HomepageHelp.js'

const { locale, t } = useI18n()

const landingLinks = ref<any[]>([])
const apiInfo = ref<any>(null)
const loading = ref(false)
const config = useRuntimeConfig()
const helpVisible = ref(false)
const helpContent = HomepageHelp

const landingUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/`
const apiSpecUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/api`

const fetchLandingAndApiInfo = async () => {
  loading.value = true
  try {
    const headers = {
      'Accept-Language': locale.value
    }
    
    const landingRes = await $fetch(landingUrl, { headers })
    landingLinks.value = landingRes.links || []

    const apiRes = await $fetch(apiSpecUrl, { headers })
    apiInfo.value = apiRes.info || {}
  } catch (err) {
    console.error('Error loading homepage data:', err)
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

 if (href.endsWith('/ogc-api/')) return t('View this document in JSON.')
  if (href.endsWith('/ogc-api/index.html')) return t('View the alternative version in HTML.')
  if (href.endsWith('/ogc-api/api')) return t('View the service description.')
  if (href.endsWith('/ogc-api/api.html')) return t('View service documentation.')
  if (href.endsWith('/ogc-api/conformance')) return t('View the conformance classes that the link\'s context conforms to.')
  if (href.endsWith('/ogc-api/conformance.html')) return t('View the alternative version in HTML.')
  if (href.endsWith('/ogc-api/processes')) return t('View the list of processes the API offers.')
  if (href.endsWith('/ogc-api/processes.html')) return t('View the alternative version in HTML.')
  if (href.endsWith('/ogc-api/jobs')) return t('View the list of job available on this server.')
  if (href.endsWith('/ogc-api/jobs.html')) return t('View the alternative version in HTML.')

  return t('View Link')
}



onMounted(fetchLandingAndApiInfo)
</script>