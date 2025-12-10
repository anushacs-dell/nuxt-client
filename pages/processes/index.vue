<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRuntimeConfig, useRouter } from '#imports'
import { useI18n } from 'vue-i18n'
import { QCard, QCardSection, QInput, QBtn, QDialog, QForm, QUploader, QSpinnerGears, Notify } from 'quasar'
import HelpDialog from '../../components/help/HelpDialog.vue'
import processListHelp from '../../components/help/processListHelp.js'

import yaml from 'js-yaml'
import { nextTick } from 'vue'


const authStore = useAuthStore()
const { locale, t } = useI18n()
const config = useRuntimeConfig()

const data = ref<any>(null)
const filter = ref('')
const router = useRouter()
const modalContent = ref('')
const showModal = ref(false)


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
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    const metaData = await metaRes.json()
    selectedProcess.value = metaData
 

    const url = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${row.id}/package`
    const res = await fetch(url, {
      headers: {
        Accept: 'application/cwl+yaml',
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    if (!res.ok) throw new Error(`Failed to fetch package (${res.status})`)
    

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
  codeRepository: "cloud_upload",
  license: "description",
};

// Convert URL - softwareVersion
const extractMetaType = (role: string) => {
  if (!role) return '';
  return role.split("/").pop(); 
};

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
          Authorization: `Bearer ${authStore.token.access_token}`,
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

// table helpers and computed 
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

        <HelpDialog v-model="helpVisible" title="Processes List Help" :help-content="helpContent" />
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


            <q-table :title="t('Processes List')" :rows="rows" :columns="columns" row-key="id" @row-click="onRowClick">
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

              <h5 class="text-weight-bold">CWL Preview</h5>

              <div id="svg-container"
                  style="width: 100%; height: 600px; overflow: auto; border: 1px solid #ddd;">
                <div id="svg-content"></div>
              </div>

              
              </div>
              <!-- Right: metadata -->
              <div class="col-4 q-mt-xl">
                <q-card flat bordered>
                  <q-card-section>
                    <p class="text-h6 text-weight-bold">Metadata</p>
                    <q-separator class="q-my-sm" />

                    <p><b>Description:</b> {{ selectedProcess?.description || '—' }}</p>
                    
                    <div class="row q-mb-sm items-center">
                      <div class="text-weight-bold">Software Version:</div>
                      <div class="q-ml-sm">{{ selectedProcess?.version || '—' }}</div>
                    </div>


                    <p><b>Keywords:</b>
                      <span v-if="selectedProcess?.keywords?.length">
                        {{ selectedProcess.keywords.join(', ') }}
                      </span>
                      <span v-else>—</span>
                    </p>


                    <q-separator class="q-my-sm" />

                    <!-- Inputs Table -->
                    <p class="text-weight-bold q-mt-md">Inputs</p>

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
                          <td>{{ val?.schema?.type || val?.type || 'unknown' }}</td>
                          <td>{{ val?.description || '—' }}</td>
                        </tr>

                        <tr v-if="!Object.keys(selectedProcess?.inputs || {}).length">
                          <td colspan="3" class="text-center text-grey">No inputs</td>
                        </tr>
                      </tbody>
                    </table>


                    <q-separator class="q-my-sm" />

                    <!-- Outputs Table -->
                    <p class="text-weight-bold q-mt-md">Outputs</p>

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
                          <td>{{ val?.schema?.type || val?.type || 'unknown' }}</td>
                          <td>{{ val?.description || '—' }}</td>
                        </tr>

                        <tr v-if="!Object.keys(selectedProcess?.outputs || {}).length">
                          <td colspan="3" class="text-center text-grey">No outputs</td>
                        </tr>
                      </tbody>
                    </table>

                <q-separator class="q-my-sm" />

                <div class="row q-mb-sm">
                  <div class="col-12 text-weight-bold q-mb-xs">Additional Metadata</div>

                  <div v-if="selectedProcess.metadata?.length" class="col-12">

                    <div
                      v-for="(md, index) in selectedProcess.metadata"
                      :key="index"
                      class="q-pa-sm bg-white rounded-borders q-mb-sm shadow-1"
                    >
                      <!-- Extract schema.org last part -->
                      <template v-if="true">
                        <div class="row items-start">

                          <!-- Icon + clickable schema link -->
                          <a
                            :href="md.role"
                            target="_blank"
                            class="q-mr-sm"
                            style="text-decoration:none;"
                          >
                            <q-icon
                              :name="iconMap[extractMetaType(md.role)] || 'info'"
                              size="22px"
                              class="text-primary"
                            />
                          </a>

                          <div>
                            <div class="text-weight-bold">
                              {{ extractMetaType(md.role) }}
                            </div>

                            <!-- CASE 1: Person object -->
                            <div v-if="md.value && typeof md.value === 'object' && md.value['@type'] === 'Person'" class="q-mt-xs">
                              <div><strong>Name:</strong> {{ md.value.name }}</div>
                              <div v-if="md.value.email"><strong>Email:</strong> {{ md.value.email }}</div>
                              <div v-if="md.value.affiliation"><strong>Affiliation:</strong> {{ md.value.affiliation }}</div>
                            </div>

                            <!-- CASE 2: Normal text value -->
                            <div v-else-if="md.title" class="text-grey-8">
                              {{ md.title }}
                            </div>
                            <!-- CASE 3: Normal value -->
                            <div v-else class="text-grey-8">
                              {{ md.value }}
                            </div>
                          </div>

                        </div>
                      </template>

                    </div>
                  </div>

                  <div v-else class="col-12">—</div>
                </div>

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
    <q-dialog v-model="showModal" persistent>
      <q-card style="min-width:600px; max-width:90vw;" class="rounded-borders">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Application Package</div>
          <q-space />
          <q-btn icon="close" flat round dense @click="showModal = false" />
        </q-card-section>
        <q-card-section>
          <div v-if="modalContent"><pre style="max-width:100%;max-height:250px;overflow:auto;">{{ modalContent }}</pre></div>
          <div v-else class="text-negative">No data or failed to fetch.</div>
        </q-card-section>
      </q-card>
    </q-dialog>


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

</style>