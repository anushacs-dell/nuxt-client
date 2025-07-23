<template>
  <q-page class="q-pa-md">
    <div class="row justify-center">
      <div class="col-12" style="max-width: 1000px;">
        <p class="text-h4 q-mb-md text-weight-bold text-primary">Job Details</p>
        <q-separator class="q-mb-md" />

        <q-card v-if="jobData" class="q-pa-md">
          <q-card-section>
            <div class="text-subtitle1 q-mb-sm">
              <q-icon name="work" class="q-mr-sm" />
              <span><strong>Job ID:</strong> {{ jobData.jobID }}</span>
            </div>

            <q-separator class="q-my-md" />

            <div class="q-mb-sm"><strong>Process ID:</strong> {{ jobData.processID }}</div>
            <div class="row items-center justify-between q-mb-sm">
              <div><strong>Status:</strong> {{ jobData.status }}</div>
              <div v-if="jobData.links && jobData.links.length" style="width: 250px;">
                <q-select
                  filled
                  dense
                  label="Job Link"
                  v-model="selectedLink"
                  :options="linkOptions"
                  option-label="label"
                  option-value="value"
                  emit-value
                  map-options
                  @update:model-value="fetchLinkContent"
                />
              </div>
            </div>

            <div class="q-mb-md"><strong>Created:</strong> {{ jobData.created }}</div>

            <div v-if="jobData.status === 'running'" class="q-mt-md">
              <div class="q-mb-sm">
                <strong>Progress:</strong> {{ jobData.progress ?? 0 }}%
                <q-linear-progress
                  color="primary"
                  :value="(jobData.progress ?? 0) / 100"
                  class="q-mt-xs"
                  rounded
                  animated
                />
              </div>

              <div class="q-mb-sm">
                <strong>Message:</strong> {{ jobData.message || 'Processing...' }}
              </div>
            </div>


            <div v-if="jobData.jobID" class="q-mt-md">
                <a :href="`${config.public.NUXT_ZOO_BASEURL}/ogc-api/jobs/${jobData.jobID}/results`" target="_blank">
                  View Full Result JSON
                </a>
            </div>
          </q-card-section>
        </q-card>

        <q-spinner v-else class="q-mt-md" />
         <div
            v-if="['successful', 'failed'].includes(jobData?.status)"
            id="map"
            class="map q-mt-lg"
            tabindex="0"
            style="height: 300px; width: 100%; max-width: 1000px;"
          />
          <ol-map
            v-if="['successful', 'failed'].includes(jobData?.status) && mapInstance"
            :instance="mapInstance"
          >
            <ol-zoomslider-control />
          </ol-map>
      </div>
    </div>


    <q-dialog v-model="showModal" persistent>
      <q-card style="min-width: 600px; max-width: 90vw;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Link Content</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="showModal = false" />
        </q-card-section>

        <q-card-section>
          <div v-if="modalContent">
            <pre style="max-width:100%;max-height:250px;overflow:auto;">{{ modalContent }}</pre>
          </div>
          <div v-else class="text-negative">No data or failed to fetch.</div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ref, onMounted, onBeforeUnmount, computed, nextTick, watch } from 'vue'
import { useRuntimeConfig } from '#imports'
import { useAuthStore } from '~/stores/auth'

import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM'
import GeoJSON from 'ol/format/GeoJSON'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'

const route = useRoute()
const config = useRuntimeConfig()
const authStore = useAuthStore()

const jobId = route.params.jobId
const jobData = ref<any>(null)
let intervalId: ReturnType<typeof setInterval>

const selectedLink = ref(null)
const modalContent = ref('')
const showModal = ref(false)
const geojsonData = ref(null)
const mapInstance = ref<Map>()

onMounted(() => {
  fetchJobDetails()
  intervalId = setInterval(fetchJobDetails, 3000)
})

onBeforeUnmount(() => {
  clearInterval(intervalId)
})


watch(
  () => jobData.value?.status,
  async (status) => {
    if ((status === 'successful' || status === 'failed') && !mapInstance.value) {
      await nextTick()
      const mapEl = document.getElementById('map')
      if (!mapEl) return

      mapInstance.value = new Map({
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        target: 'map',
        view: new View({
          center: [0, 0],
          zoom: 2,
          projection: 'EPSG:4326',
        }),
      })
    }
  }
)


const fetchJobDetails = async () => {
  try {
    const response = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
      },
    })
    jobData.value = response

    if (response.status === 'succeeded' || response.status === 'failed') {
      clearInterval(intervalId)
    }
  } catch (err) {
    console.error('Error fetching job details:', err)
    clearInterval(intervalId)
  }
}

const linkOptions = computed(() => {
  if (!jobData.value?.links) return []
  return jobData.value.links.map((link: any, index: number) => ({
    label: link.title || link.rel || `Link ${index + 1}`,
    value: link.href,
  }))
})

const fetchLinkContent = async (href: string) => {
  try {
    const response = await $fetch(href, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
      },
    })

    for (const key in response) {
      if (response[key]?.value) {
        const featureCollection = response[key].value
        if (featureCollection?.type === 'FeatureCollection') {
          geojsonData.value = featureCollection
          showModal.value = false
          showMapOnGeojson()
          return
        }
      }
    }

    modalContent.value = JSON.stringify(response, null, 2)
    showModal.value = true

  } catch (err) {
    modalContent.value = 'Failed to fetch link content'
    showModal.value = true
    console.error(err)
  }
}

async function showMapOnGeojson() {
  await nextTick()
  if (!mapInstance.value || !geojsonData.value) return

  const format = new GeoJSON()
  const features = format.readFeatures(geojsonData.value, {
    featureProjection: 'EPSG:4326',
  })

 
  mapInstance.value.getLayers().forEach((layer) => {
    if (layer instanceof VectorLayer) {
      mapInstance.value.removeLayer(layer)
    }
  })

  const vectorSource = new VectorSource({ features })
  const vectorLayer = new VectorLayer({ source: vectorSource })
  mapInstance.value.addLayer(vectorLayer)

  const extent = vectorSource.getExtent()
  mapInstance.value.getView().fit(extent, {
    padding: [50, 50, 50, 50],
    maxZoom: 10,
    duration: 1000,
  })
}

</script>