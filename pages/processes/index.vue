<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRuntimeConfig, useRouter } from '#imports'
import { useI18n } from 'vue-i18n'
import { QCard, QCardSection, QInput, QBtn, QDialog, QForm, QUploader, QSpinnerGears, Notify } from 'quasar'
import HelpDialog from '../../components/help/HelpDialog.vue'
import processListHelp from '../../components/help/processListHelp.js'

import AppDialog from '~/components/modal/AppDialog.vue'

import yaml from 'js-yaml'
import { nextTick } from 'vue'


const authStore = useAuthStore()
const { locale, t } = useI18n()
const config = useRuntimeConfig()

const data = ref<any>(null)
const filter = ref('')
const router = useRouter()
const modalContent = ref<string | null>(null)
const packageError = ref<string | null>(null)
const showModal = ref(false)
const selectedPackageProcessId = ref('')



const helpVisible = ref(false)
const helpContent = processListHelp


const loadingCwl = ref(false)
const svgViewer = ref<any | null>(null)
const selectedProcess = ref<Record<string, any> | null>(null)

const zoomLevel = ref(1)

const dialog = ref(false)
const processName = ref('')
const fileContent = ref('')
const file = ref<File | null>(null)



//basic helpers 
function debug(msg: string) { console.log('[proc:index] ', msg) }

const viewProcess = (row: any) => {
  router.push(`/processes/${row.id}`)
}

// fetch package 
const packageProcess = async (row: any) => {
  selectedPackageProcessId.value = row.id //store Id for filename
  modalContent.value = null
  packageError.value = null
  try {
    const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}/package`, {
      method: 'GET',
      headers: {
        "Accept": "application/cwl+yaml",
        'Authorization': `Bearer ${authStore.token?.access_token}`,
        'Accept-Language': locale.value
      }
    })
    if (response.ok) {
      modalContent.value = await response.text()
    } else if (response.status === 404) {
      packageError.value = t(
        'Application package is not available. It may have been removed after a service restart.'
      )
    } else {
      packageError.value = t(
        'Failed to load application package.'
      )
    }

    showModal.value = true
  } catch (error) {
    console.error('Application Package request failed', error)
    packageError.value = t(
      'Unable to reach the server to retrieve the application package.'
    )
    showModal.value = true
  }
}

const downloadCWL = () => {
  if (!modalContent.value) return;

  // Create a blob from the modal content
  const blob = new Blob([modalContent.value], {
    type: "text/yaml"
  });

  // Create a temporary download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  // Use processId from packageProcess()
  const filename = `${selectedPackageProcessId.value || 'application-package'}.cwl`

  a.href = url;
  a.download = filename
  a.click();

  // Clean up
  URL.revokeObjectURL(url);
};

// load cwl-svg demo bundles  
const loadSvgScripts = async () => {
  if (process.server || (window as any).svgScriptsLoaded) return
  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve()
      s.onerror = (e) => reject(new Error(`Failed to load ${src}`))
      document.body.appendChild(s)
    })

  try {

    if (!(window as any).jsyaml) {
      const yamlModule = await import('js-yaml')
      ;(window as any).jsyaml = yamlModule
      console.log('✅ js-yaml exposed globally')
    }
    // order matters for your demo
    await loadScript('/cwl-demo/cwl-svg.bundle.js')
    await loadScript('/cwl-demo/cwl-svg-custom.js')
    await loadScript('/cwl-demo/cwl-visualizer-api.js')
    await loadScript('/cwl-demo/cwl-visualizer.js')
    ;(window as any).svgScriptsLoaded = true
    console.log('✅ CWL SVG bundles loaded')
  } catch (err) {
    console.error('Failed to load CWL scripts', err)
    throw err
  }
}

// visualization: fetch package and render 
const visualizeCwl = async (row: any) => {
  loadingCwl.value = true
  await nextTick()

  try {
    await loadSvgScripts()

    //  Fetch the full process metadata (with inputs/outputs)
    const metaUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}`
    const metaRes = await fetch(metaUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authStore.token?.access_token}`,
        'Accept-Language': locale.value
      }
    })
    const metaData = await metaRes.json()
    selectedProcess.value = metaData
 

    const url = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}/package`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/cwl+yaml',
        Authorization: `Bearer ${authStore.token?.access_token}`,
        'Accept-Language': locale.value
      }
    })
    if (!res.ok) {
      Notify.create({
        type: 'warning',
        message: t(
          'CWL package cannot be accessed'
        )
      })
      return
    }

    const response = await fetch('/cwl-demo/example-workflow.cwl')
    const yamlText = await res.text()
    const cwlObject = yaml.load(yamlText)
    await nextTick()
    renderCwl(yamlText)
    if (!cwlObject.class) {
      cwlObject.class = "Workflow"
    }
  } catch (err: any) {
    showError(err?.message || 'Visualization failed')
  } finally {
    loadingCwl.value = false
  }
}

const iconMap: Record<string, string> = {
  softwareVersion: "apps",
  author: "person",
  contributor: "group",
  organization: "business",
  license: "description",
  keywords: "tag",
  address: 'place',
  codeRepository: "cloud_upload",
};


const SCHEMA_INTERNAL_KEYS = ['class', '@context', '@type'];

const extractMetaType = (role: string) => {
  if (!role) return '';
  return role.split("/").pop(); 
}; 

const isUrl = (value) => {
  if (typeof value !== "string") return false;
  return value.startsWith("http://") || value.startsWith("https://");
};

const openSchema = (url) => {
  window.open(url, "_blank");
};

const getEntityType = (value: any) => {
  return value?.['@type'] || null;
};

const getEntitySchemaUrl = (value: any) => {
  return value?.['@type']
    ? `https://schema.org/${value['@type']}`
    : null;
};

const getRenderableFields = (value: any) => {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).filter(
    ([key]) => !SCHEMA_INTERNAL_KEYS.includes(key)
  )
}

const prettyAddressKey = (key: string) => {
  if (key === 's:addressCountry' || key === 'addressCountry') return 'Country'
  return key
}


const onRowClick = async (evt, row, index) => {
  selectedProcess.value = row

  //  If the process has a package do not open cwl, just open details
  if (row.mutable === false) {
    router.push(`/processes/${row.id}`)
    return
  }

  // Normal process , show CWL preview automatically
  await visualizeCwl(row)
}




// render into DOM 
const renderCwl = async (yamlText: string) => {
  const container = document.getElementById('svg-container');
  if (!container) {
    console.error('svg-container not found');
    return;
  }

  let contentEl = document.getElementById('svg-content');
  if (!contentEl) {
    contentEl = document.createElement('div');
    contentEl.id = 'svg-content';
    container.appendChild(contentEl);
  }

  container.scrollTop = 0;

  if (!(window).CWLSVGCustom) {
    showError('CWLSVGCustom library not loaded');
    return;
  }

  try {
    svgViewer.value = new (window).CWLSVGCustom(contentEl, {
      width: contentEl.clientWidth || 1200,
      height: Math.max(600, contentEl.clientHeight || 600),
      nodeWidth: 150,
      nodeHeight: 70
    });

    // Pass the raw CWL YAML text
    await svgViewer.value.loadWorkflow(yamlText);

    if (typeof svgViewer.value.render === 'function') {
      svgViewer.value.render();
    }

    console.log('✅ CWL rendered successfully');
  } catch (e) {
    console.error('Render error', e);
    showError('Render failed: ' + e.message);
  }
}




// file input handling (hidden input) 
const handleFileInputChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const fileSelected = input?.files?.[0]
  if (!fileSelected) return
  document.getElementById('file-name')!.innerText = fileSelected.name
  document.getElementById('file-size')!.innerText = `(${(fileSelected.size / 1024).toFixed(1)} KB)`
  const text = await fileSelected.text()
  const cwlObject = yaml.load(text)
  await loadSvgScripts()
  renderCwl(yamlText)
}



// conformance check 
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

// delete process 
const deleteProcess = async (row: any) => {
  if (confirm(t('Are you sure you want to delete the process') + ` "${row.id}"?`)) {
    try {
      const response = await fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${authStore.token?.access_token}`,
          'Accept-Language': locale.value 
        }
      })
      if (response.ok) {
        Notify.create({ message: t('Process deleted successfully'), type: 'positive' })
        await fetchData()
      } else {
        Notify.create({ message: t('Process deletion failed'), type: 'negative' })
      }
    } catch (e) {
      Notify.create({ message: t('Delete request failed'), color: 'negative', icon: 'error' })
      console.error(e)
    }
  }
}

// add process dialog functions unchanged 
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
    reader.onload = (e) => (fileContent.value = e.target?.result as string)
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
        'Authorization': `Bearer ${authStore.token?.access_token}`,
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
        Authorization: `Bearer ${authStore.token?.access_token}`,
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

// table helpers and computed 
const columns = [
  {
    name: 'id',
    label: '#',
    field: 'id',
    align: 'left',
    sortable: true,
    style: 'width: 160px'
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    align: 'left',
    sortable: true,
    style: 'width: 100%;'
  },
  {
    name: 'link',
    label: 'Actions',
    align: 'center',
    style: 'width: 140px',
    sortable: false
  }
]

const getInputType = (input: any) => {
  const schema =
    input?.['original-schema'] ||   
    input?.schema ||
    input

  // Handle allOf
  if (schema?.allOf && Array.isArray(schema.allOf)) {
    const refObj = schema.allOf.find((s: any) => s.$ref)
    const formatObj = schema.allOf.find((s: any) => s.format)

    if (formatObj?.format && refObj?.$ref) {
      return {
        label: formatObj.format,
        link: refObj.$ref
      }
    }
  }

  if (schema?.type) {
    return { label: schema.type }
  }

  return { label: 'object' }
}

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

        <p class="text-h4 q-mb-md text-weight-bold">{{ t('Processes List') }}</p>

        <!-- Buttons row -->
        <div class="row items-center q-mb-md">
          <!-- Help Button -->
          <q-btn
            flat
            icon="help_outline"
            color="primary"
            :label="t('Help')"
            @click="helpVisible = true"
          />

          <q-space />

          <!-- Add Process Button -->
          <q-btn
            v-if="isConformToCwl === true"
            color="primary"
            icon="add"
            :label="t('Add Process')"
            @click="openDialog"
            :loading="isCheckingConformance"
          />
        </div>

        <HelpDialog
          v-model="helpVisible"
          :title="t('Processes List Help')"
        >
          <div
            v-if="helpContent"
            v-html="helpContent"
          />
          <div v-else class="text-negative">
            {{ t('No data or failed to fetch') }}
          </div>
        </HelpDialog>
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
              wrap-cells
              table-layout="fixed"
              @row-click="onRowClick"
            >
              <template v-slot:body-cell-description="{ row }">
                <q-td class="description-td">
                  <div class="description-cell">
                    {{ row.description || '—' }}
                  </div>
                </q-td>
              </template>
              <template v-slot:body-cell-link="{ row }">
                <q-td class="text-center">
                  <q-btn-dropdown v-if="row.mutable === true" color="primary" label="Actions" flat @click.stop>
                    <q-list>
                      <q-item clickable v-close-popup @click="viewProcess(row)"><q-item-section>{{ t('View') }}</q-item-section></q-item>
                      <q-item clickable v-close-popup @click="packageProcess(row)"><q-item-section>{{ t('Package') }}</q-item-section></q-item>
                      <q-item clickable v-close-popup @click="deleteProcess(row)"><q-item-section class="text-negative">{{ t('Delete') }}</q-item-section></q-item>
                    </q-list>
                  </q-btn-dropdown>
                  <NuxtLink v-else :to="`/processes/${row.id}`" @click.stop>{{ row.id }}</NuxtLink>
                </q-td>
              </template>
            </q-table>
            <!-- CWL Preview Section (UNDER the table) -->
            <div v-if="selectedProcess" class="row q-col-gutter-lg q-mt-lg">
              <div class="col-8">

              <h5 class="text-weight-bold">{{ t('CWL Preview') }}</h5>

              <div id="svg-container"
                  style="width: 100%; height: 600px; overflow: auto; border: 1px solid #ddd;">
                <div id="svg-content"></div>
              </div>

              
              </div>
              <!-- Right: metadata -->
              <div class="col-4 q-mt-xl">
                <q-card flat bordered>
                  <q-card-section>
                    <p class="text-h6 text-weight-bold">{{ t('Metadata') }}</p>
                    <q-separator class="q-my-sm" />

                    <p><b>Description</b> {{ selectedProcess?.description || '—' }}</p>
                    
                    <div class="row q-mb-sm items-center">
                      <div class="text-weight-bold">{{ t('Software Version') }}</div>
                      <div class="q-ml-sm">{{ selectedProcess?.version || '—' }}</div>
                    </div>


                    <div class="row q-mb-sm items-center">
                      <div class="text-weight-bold">{{ t('Keywords') }}</div>
                      <div class="q-ml-sm">
                        <span v-if="selectedProcess?.keywords?.length">
                          {{ selectedProcess.keywords.join(', ') }}
                        </span>
                        <span v-else>—</span>
                      </div>
                    </div>

                    <q-separator class="q-my-sm" />

                    <!-- Inputs Table -->
                    <p class="text-weight-bold q-mt-md">{{ t('Inputs') }}</p>

                    <table class="custom-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr v-for="([key, val]) in Object.entries(selectedProcess?.inputs || {})" :key="key">
                          <td>{{ key }}</td>
                          <td>
                            <template v-if="getInputType(val).link">
                              <a
                                :href="getInputType(val).link"
                                target="_blank"
                                class="text-primary"
                              >
                                {{ getInputType(val).label }}
                              </a>
                            </template>

                            <template v-else>
                              {{ getInputType(val).label }}
                            </template>
                          </td>
                          <td>{{ val?.description || '—' }}</td>
                        </tr>

                        <tr v-if="!Object.keys(selectedProcess?.inputs || {}).length">
                          <td colspan="3" class="text-center text-grey">No inputs</td>
                        </tr>
                      </tbody>
                    </table>


                    <q-separator class="q-my-sm" />

                    <!-- Outputs Table -->
                    <p class="text-weight-bold q-mt-md">{{ t('Outputs') }}</p>

                    <table class="custom-table">
                      <thead>
                        <tr>
                          <th>Label</th>
                          <th>Type</th>
                          <th>Description</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr v-for="([key, val]) in Object.entries(selectedProcess?.outputs || {})" :key="key">
                          <td>{{ key }}</td>
                          <td>
                            <template v-if="getInputType(val).link">
                              <a
                                :href="getInputType(val).link"
                                target="_blank"
                                class="text-primary"
                              >
                                {{ getInputType(val).label }}
                              </a>
                            </template>

                            <template v-else>
                              {{ getInputType(val).label }}
                            </template>
                          </td>
                          <td>{{ val?.description || '—' }}</td>
                        </tr>

                        <tr v-if="!Object.keys(selectedProcess?.outputs || {}).length">
                          <td colspan="3" class="text-center text-grey">No outputs</td>
                        </tr>
                      </tbody>
                    </table>

                <q-separator class="q-my-sm" />

                <q-expansion-item
                  expand-separator
                  icon="info"
                  :label="t('Additional Metadata')"
                  dense
                  dense-toggle
                  class="rounded-borders bg-white q-mt-md shadow-1"
                >
                  <q-card-section>

                    <div v-if="selectedProcess.metadata?.length">

                      <div
                        v-for="(md, i) in selectedProcess.metadata"
                        :key="i"
                        class="q-py-sm q-mb-sm border-bottom"
                        style="border-bottom: 1px solid #eee;"
                      >

                    <div class="row items-center q-mb-xs">

                      <!-- ICON (left side, decorative only) -->
                      <q-icon
                        :name="iconMap[extractMetaType(md.role)] || 'info'"
                        size="18px"
                        class="text-primary q-mr-sm"
                      />

                      <!-- LABEL (clickable - schema.org page) -->
                        <div
                          class="text-weight-bold text-primary"
                          :class="{ 'cursor-pointer': md.role }"
                          @click="md.role && openSchema(md.role)"
                        >
                        {{ md.role ? extractMetaType(md.role) : md.title }}
                      </div>

                    </div>
                      <!--title-only metadata -->
                      <div v-if="md.title && !md.value" class="q-mt-xs text-grey-8">
                        {{ md.title }}
                      </div>


                      <!-- Simple string value -->
                      <div v-else-if="typeof md.value === 'string'" class="q-mt-xs text-grey-8 long-text">
                        <template v-if="isUrl(md.value)">
                          <a :href="md.value" target="_blank" class="text-primary">
                            {{ md.value }}
                          </a>
                        </template>
                        <template v-else>
                          {{ md.value }}
                        </template>
                      </div>

                      <!-- Object value -->
                      <div v-else-if="typeof md.value === 'object'" class="q-mt-xs">

                        <!-- ENTITY TYPE -->
                        <div
                          v-if="getEntityType(md.value)"
                          class="text-caption text-primary cursor-pointer q-mb-xs"
                          @click="openSchema(getEntitySchemaUrl(md.value))"
                        >
                          {{ getEntityType(md.value) }}
                        </div>



                        <!-- ENTITY FIELDS -->
                          <div
                            v-for="([key, v], i) in getRenderableFields(md.value)"
                            :key="i"
                            class="q-mb-xs text-grey-8"
                          >

                        <template v-if="key === 'address' && typeof v === 'object'">
                          <div class="q-mt-sm">
                            <strong>
                              <q-icon name="place" size="14px" class="q-mr-xs text-primary" />
                              address:
                            </strong>

                            <div class="q-ml-lg q-mt-xs">
                              <div
                                v-for="([addrKey, addrVal], i) in getRenderableFields(v)"
                                :key="i"
                                class="q-mb-xs"
                              >
                                <strong>{{ prettyAddressKey(addrKey) }}:</strong>
                                <span class="q-ml-xs">{{ addrVal }}</span>
                              </div>
                            </div>
                          </div>
                        </template>

                          
                        <!-- Normal fields -->
                        <template v-else>
                          <strong class="q-mr-xs">{{ key }}:</strong>

                          <span class="long-text">
                            <template v-if="isUrl(v)">
                              <a :href="v" target="_blank" class="text-primary">
                                {{ v }}
                              </a>
                            </template>
                            <template v-else>
                              {{ v }}
                            </template>
                          </span>
                        </template>
                        </div>

                      </div>

                      </div>

                    </div>

                    <div v-else class="text-grey-6">
                      —
                    </div>

                  </q-card-section>
                </q-expansion-item>

                  </q-card-section>
                </q-card>
              </div>
            </div>


      </div>
    </div>

    <!-- Add Process Dialog -->
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

    <!-- Package Modal -->
    <AppDialog
      v-model="showModal"
      :title="t('Application Package')"
    >
      <div v-if="modalContent">
        <pre class="dialog-pre">{{ modalContent }}</pre>
        </div>
          <!-- ERROR -->
          <div v-else-if="packageError" class="text-negative">
            <q-icon name="warning" size="18px" class="q-mr-sm" />
            {{ packageError }}
          </div>

          <!-- LOADING / EMPTY -->
          <div v-else class="text-grey-6">
            {{ t('Loading package information...') }}
          </div>
        <template #footer>
          <div class="row justify-end">
            <q-btn
              color="primary"
              :label="t('Download CWL')"
              @click="downloadCWL"
            />
          </div>
        </template>
      </AppDialog>

  </q-page>
</template>
<style>
.custom-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  background: white;
  border-radius: 4px;
  overflow: hidden;
  font-size: 14px;
}

.custom-table th {
  background: #f2f2f2;
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
}

.custom-table td {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.custom-table tr:last-child td {
  border-bottom: none;
}

.long-text {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.description-cell {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.dialog-pre {
  max-width: 100%;
  white-space: pre-wrap;
  word-break: break-word;
}

.description-td {
  vertical-align: top;
}
</style>
