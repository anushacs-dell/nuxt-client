<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRuntimeConfig, useRouter } from '#imports'
import { useI18n } from 'vue-i18n'

const authStore = useAuthStore()
const { locale, t } = useI18n()

const config = useRuntimeConfig()
const data = ref(null)
const filter = ref('')
const router = useRouter()
const modalContent = ref('')
const showModal = ref(false)
const toDisplayString = ref('')

import { QCard, QCardSection, QInput, QBtn, QDialog, QForm, QUploader, QSpinnerGears, Notify } from 'quasar';

const viewProcess = (row: any) => {
  router.push(`/processes/${row.id}`)
}

const packageProcess = async (row: any) => {
    try {
      const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}/package`, {
        method: 'GET',
        headers: {
          "Accept": "application/cwl+yaml",
          'Authorization': `Bearer ${authStore.token.access_token}`,
           'Accept-Language': locale.value
        }
      })
      if (response.ok) {
        console.log('Application Package downloaded successfully')
        modalContent.value = await response.text()
        showModal.value = true
      } else {
        console.error('Error downloading Application Package')
        showModal.value = false
      }
    } catch (error) {
      console.error('Application Package request failed', error)
      showModal.value = false
    }

}

const isConformToCwl = ref(false)
const isCheckingConformance = ref(false)

const checkConformance = async () => {
  isCheckingConformance.value = true
  try {
    const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/conformance`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
         'Accept-Language': locale.value
      }
    })

    if (response.ok) {
      const conformance = await response.json()
      console.log('Conformance response:', conformance)

      // Vérifier si l'API supporte le déploiement CWL
      const cwlConformanceUrl = 'http://www.opengis.net/spec/ogcapi-processes-2/1.0/conf/deploy-replace-undeploy'
      isConformToCwl.value = conformance.conformsTo?.includes(cwlConformanceUrl) || false

      console.log('CWL Conformance:', isConformToCwl.value)
    } else {
      console.error('Error fetching conformance:', response.status)
      isConformToCwl.value = false
    }
  } catch (error) {
    console.error('Error fetching conformance', error)
    isConformToCwl.value = false
  } finally {
    isCheckingConformance.value = false
  }
}

const deleteProcess = async (row: any) => {
  if (confirm(t('Are you sure you want to delete the process') + ` "${row.id}"?`)) {
    try {
      const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authStore.token.access_token}`,
          'Accept-Language': locale.value
        }
      })
      
      if (response.ok) {
        Notify.create({
          message: t('Process deleted successfully'),
          type: 'positive'
        })
        await fetchData()
        console.log('Process deleted successfully')
      } else {
        console.error('Error deleting process')
        Notify.create({
          message: t('Process deletion failed'),
          type: 'negative'
        })
      }
    } catch (error) {
      console.error('Delete request failed', error)
      Notify.create({
        message: t('Delete request failed'),
        color: 'negative',
        icon: 'error'
      })
    }
  }
}

// Dialog process form
const dialog = ref(false)
const processName = ref('')
const fileContent = ref('')
const file = ref<File | null>(null)

const openDialog = () => {
  dialog.value = true
}

const closeDialog = () => {
  dialog.value = false
  processName.value = ''
  fileContent.value = ''
  file.value = null
  // (refs.uploader as any).reset();
}

const onFileAdded = (files: File[]) => {
  if (files.length > 0) {
    file.value = files[0]
    const reader = new FileReader()
    reader.onload = (e) => {
      fileContent.value = e.target?.result as string
    }
    reader.readAsText(file.value)
  }
}

const submitForm = async () => {
  if (!fileContent.value) {
    return
  }

  try {
    const formData = new FormData()
    formData.append('file', file.value)
    Notify.create({
          spinner: QSpinnerGears,
          message: t('Deploying process...'),
          timeout: 2000
    })
    const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes?w=${processName.value}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/cwl+yaml',
        'Authorization': `Bearer ${authStore.token.access_token}`,
         'Accept-Language': locale.value
      },
      body: fileContent.value,
    })

    if(response.ok) {
      console.log('Process deployed successfully.')
      Notify.create({
        message: t('Process deployed successfully'),
        type: 'positive'
      })
      fetchData()
    } else {
      console.error('Error deploying process.')
      Notify.create({
        message: t('Failed to deploy process'),
        color: 'negative',
        icon: 'error'
      })
    }
  } catch (error) {
    console.error('Request failed', error)
      Notify.create({
        message: t('Request failed'),
        color: 'negative',
        icon: 'error'
      })
  }

  closeDialog()
}

const fetchData = async () => {
  try {
    data.value = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

onMounted(() => {
  checkConformance()
  fetchData()
})

const columns = [
  { name: 'id', label: '#', field: 'id', align: 'left', sortable: true },
  { name: 'description', label: 'Description', field: 'description', align: 'left', sortable: true },
  {
    name: 'link',
    label: 'Lien',
    field: row => row.links?.[0]?.href || '',
    align: 'left',
    sortable: false
  }
]

const rows = computed(() => {
  if (!data.value?.processes) return []
  const term = filter.value.toLowerCase()
  return data.value.processes.filter(p => {
    const idMatch = p.id.toLowerCase().includes(term)
    const descMatch = (p.description ?? '').toLowerCase().includes(term)
    return idMatch || descMatch
  })
})

const formattedData = computed(() => JSON.stringify(data.value, null, 2))

const onClearSearch = async () => {
  filter.value = ''
  await fetchData()
}

</script>

<template>
  <q-page class="q-pa-sm">
    <div class="row justify-center">
      <div class="col-12 q-pa-md" style="max-width: 1080px;">
        <p class="text-h4 q-mb-md text-weight-bold">{{t('Processes List')}}</p>
        <q-btn
          v-if="isConformToCwl === true"
          color="primary"
          icon="add"
          :label="t('Add Process')"
          @click="openDialog"
          :loading="isCheckingConformance"
        />
        <q-separator />

        <div class="q-mb-md">
          <q-input
            filled
            v-model="filter"
            :label="t('Search')"
            debounce="300"
            clearable
            prepend-icon="search"
            @clear="onClearSearch"
          />
        </div>

        <q-table
          :title="t('Processes List')"
          :rows="rows"
          :columns="columns"
          row-key="id"
        >
          <template v-slot:body-cell-link="{ row }">
            <q-td class="text-center">
              <q-btn-dropdown v-if="row.mutable === true" color="primary" label="Actions" flat >
                <q-list>
                  <q-item clickable v-close-popup @click="viewProcess(row)">
                    <q-item-section>{{t('View')}}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="packageProcess(row)">
                    <q-item-section>{{ t('Package') }}</q-item-section>
                  </q-item>
                  <q-item clickable v-close-popup @click="deleteProcess(row)">
                    <q-item-section class="text-negative">{{t('Delete')}}</q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
              <NuxtLink v-else :to="`/processes/${row.id}`" >{{ row.id }}</NuxtLink>
            </q-td>
          </template>
        </q-table>

        <q-separator />

      </div>
    </div>

    <q-dialog v-model="dialog" persistent>
      <q-card style="min-width: 800px; max-width: 90vw;">
        <q-card-section>
          <div class="text-h6">{{t('Add a Process')}}</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="submitForm">
            <q-input v-model="processName" :label="t('Process Name')" />

            <q-uploader
              :label="t('Upload a .cwl file')"
              accept=".cwl"
              @added="onFileAdded"
              ref="uploader"
              :hide-upload-btn="true"
              :hide-upload-progress="true"
              style="width: 100%;"
            />

            <q-input
              v-model="fileContent"
              :label="t('File Content')"
              type="textarea"
              @change="fileContent = $event.target.value"
              required
            />

            <div class="q-mt-md">
              <q-btn type="submit" :label="t('Submit')" color="primary" />
              <q-btn flat :label="t('Cancel')" @click="closeDialog" color="negative" />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showModal" persistent>
      <q-card style="min-width: 600px; max-width: 90vw;" class="rounded-borders">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Application Package</div>
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
