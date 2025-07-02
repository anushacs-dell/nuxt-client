<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRuntimeConfig } from '#imports'

const {
  params: { processId }
} = useRoute()

const authStore = useAuthStore()
const config = useRuntimeConfig()

const data = ref(null)
const inputValues = ref<Record<string, any>>({})
const outputValues = ref<Record<string, any>>({})
const response = ref(null)
const loading = ref(false)
const jobStatus = ref('')

const jsonRequestPreview = ref('')
const showDialog = ref(false)

const subscriberValues = ref({
  successUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-83dcc87e-55a7-11f0-abed-0242ac106a07&type=success',
  inProgressUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-83dcc87e-55a7-11f0-abed-0242ac106a07&type=inProgress',
  failedUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-83dcc87e-55a7-11f0-abed-0242ac106a07&type=failed'
})

const fetchData = async () => {
  try {
    data.value = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`
      }
    })

    if (data.value && data.value.inputs) {
      for (const [key, input] of Object.entries(data.value.inputs)) {
        if (input.type === 'BoundingBoxData') {
          inputValues.value[key] = {
            minx: 0,
            miny: 0,
            maxx: 0,
            maxy: 0
          }
        } else if (input.type === 'ComplexData') {
          inputValues.value[key] = ''
        } else {
          inputValues.value[key] = input.schema?.default ?? (input.schema?.type === 'number' ? 0 : '')
        }
      }
    }

    if (data.value && data.value.outputs) {
      for (const [key, input] of Object.entries(data.value.outputs)) {
        if(input.schema.oneOf?.length > 0){
          const myEnum=[]
          for(var i=0;i<input.schema.oneOf.length;i++){
            if(input.schema.oneOf[i].type=="object")
              myEnum.push("application/json")
            else 
              myEnum.push(input.schema.oneOf[i].contentMediaType)
          }
          outputValues.value[key] = [{ id: "transmission", enum: ["reference","value"], cval: "reference" },{ id: "format", enum: myEnum, cval: myEnum[0] }]
        }else{
          outputValues.value[key] = [{ id: "transmission", enum: ["value","reference"], cval: "value" }]
        }
      }
    }
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

onMounted(() => {
  fetchData()
})

const convertOutputsToPayload = (outputs: Record<string, any[]>) => {
  const result: Record<string, any> = {}
  for (const [key, outputArray] of Object.entries(outputs)) {
    if (outputArray && outputArray.length > 0) {
      const outputConfig: any = {}
      outputArray.forEach(item => {
        if (item.id === 'transmission') {
          outputConfig.transmissionMode = item.cval
        } else if (item.id === 'format') {
          outputConfig.format = {
            mediaType: item.cval
          }
        }
      })
      result[key] = outputConfig
    }
  }
  return result
}

watch([inputValues, outputValues, subscriberValues], ([newInputs, newOutputs, newSubscribers]) => {
  const wrappedInputs = Object.fromEntries(
    Object.entries(newInputs).map(([key, val]) => {
      const inputType = data.value?.inputs?.[key]?.type

      if (inputType === 'ComplexData') {
        return [key, { href: val }]
      }

      if (inputType === 'BoundingBoxData') {
        return [key, {
          bbox: {
            lowerCorner: [val.minx, val.miny],
            upperCorner: [val.maxx, val.maxy],
            crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84'
          },
          crs: 'urn:ogc:def:crs:EPSG:6.6:4326'
        }]
      }

      return [key, typeof val === 'object' ? { value: val } : val]
    })
  )

  const payload = {
    inputs: wrappedInputs,
    outputs: convertOutputsToPayload(newOutputs),
    subscriber: {
      successUri: newSubscribers.successUri,
      inProgressUri: newSubscribers.inProgressUri,
      failedUri: newSubscribers.failedUri
    }
  }

  jsonRequestPreview.value = JSON.stringify(payload, null, 2)
}, { deep: true })

const pollJobStatus = async (jobId: string) => {
  const jobUrl = `${config.public.NUXT_ZOO_BASEURL}/ogc-api/jobs/${jobId}`
  const headers = {
    Authorization: `Bearer ${authStore.token.access_token}`
  }

  while (true) {
    try {
      const job = await $fetch(jobUrl, { headers })
      jobStatus.value = job.status

      if (job.status === 'successful') {
        response.value = job
        loading.value = false
        break
      } else if (job.status === 'failed') {
        response.value = { error: 'Job failed', details: job }
        loading.value = false
        break
      }

      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch (err) {
      console.error('Polling error:', err)
      loading.value = false
      break
    }
  }
}

const submitProcess = async () => {
  try {
    loading.value = true
    response.value = null
    jobStatus.value = 'submitted'

    const payload = JSON.parse(jsonRequestPreview.value)

    const res = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}/execution`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (res.jobID) {
      await pollJobStatus(res.jobID)
    } else {
      loading.value = false
      response.value = res
    }
  } catch (error) {
    console.error('Execution error:', error)
    loading.value = false
  }
}

const isMultipleInput = (input: any) => {
  return input.maxOccurs > 1
}

const addInputField = (inputId: string) => {
  if (!Array.isArray(inputValues.value[inputId])) {
    inputValues.value[inputId] = [inputValues.value[inputId] || '']
  }
  inputValues.value[inputId].push('')
}

const removeInputField = (inputId: string, index: number) => {
  if (Array.isArray(inputValues.value[inputId]) && inputValues.value[inputId].length > 1) {
    inputValues.value[inputId].splice(index, 1)
  }
}
</script>

<template>
  <q-page class="q-pa-md">
    <div v-if="data">
   
      <div class="q-mb-lg">
        <div class="text-h3 text-weight-bold text-primary q-mb-sm">
          {{ data.id }}
        </div>
        <div class="text-subtitle1 text-grey-7">
          {{ data.description }}
        </div>
        <q-separator class="q-mt-md" />
      </div>

      <!-- <h4>{{ data.id }} - {{ data.description }}</h4> -->

<q-form @submit.prevent="submitProcess">

  <div class="q-mb-lg">
    <div class="text-h4 text-weight-bold text-primary q-mb-sm">
      Inputs
    </div>
    <q-separator class="q-mt-md" />
  </div>

  <div v-for="(input, inputId) in data.inputs" :key="inputId" class="q-mb-md">
    <q-card class="q-pa-md">
      <div class="row items-center q-mb-sm">
        <div class="text-blue text-bold">{{ inputId.toUpperCase() }}</div>
        <q-space />
        <q-btn 
          v-if="isMultipleInput(input)"
          round 
          dense 
          flat 
          icon="add" 
          color="primary" 
          size="sm"
          @click="addInputField(inputId)"
        >
          <q-tooltip>Add another value</q-tooltip>
        </q-btn>
        <q-btn 
          v-if="isMultipleInput(input)"
          round 
          dense 
          flat 
          icon="delete" 
          color="primary" 
          size="sm"
          @click="removeInputField(inputId)"
        >
          <q-tooltip>Delete the last value</q-tooltip>
        </q-btn>
      </div>

      <div class="q-gutter-sm row items-center">
        <q-badge color="grey-3" text-color="black">
          {{ input.type }}
        </q-badge>

        <!-- LiteralData -->
        <q-input
          v-if="input.type === 'LiteralData' && !input.schema?.enum"
          filled
          v-model="inputValues[inputId]"
          :type="input.schema?.type === 'number' ? 'number' : 'text'"
          :label="input.title || inputId"
          dense
          class="q-ml-sm"
          style="flex: 1"
        />

        <q-select
          v-else-if="input.type === 'LiteralData' && input.schema?.enum"
          filled
          v-model="inputValues[inputId]"
          :options="input.schema.enum"
          :label="input.title || inputId"
          dense
          class="q-ml-sm"
          style="flex: 1"
        />

        <!-- ComplexData -->
        <q-input
          v-else-if="input.type === 'ComplexData'"
          filled
          type="textarea"
          v-model="inputValues[inputId]"
          :label="input.title || inputId"
          autogrow
          dense
          class="q-ml-sm"
          style="flex: 1"
        />

        <!-- BoundingBoxData -->
        <div v-else-if="input.type === 'BoundingBoxData'" class="q-ml-sm row q-gutter-sm" style="flex: 1;">
          <q-input v-model="inputValues[inputId].minx" type="number" label="Min X" dense style="width: 100px" />
          <q-input v-model="inputValues[inputId].miny" type="number" label="Min Y" dense style="width: 100px" />
          <q-input v-model="inputValues[inputId].maxx" type="number" label="Max X" dense style="width: 100px" />
          <q-input v-model="inputValues[inputId].maxy" type="number" label="Max Y" dense style="width: 100px" />
        </div>

        <!-- Fallback -->
        <q-input
          v-else
          filled
          v-model="inputValues[inputId]"
          :label="input.title || inputId"
          dense
          class="q-ml-sm"
          style="flex: 1"
        />
      </div>
    </q-card>
  </div>

  <div class="q-mt-md row q-gutter-sm">
    <q-btn label="Submit" type="submit" color="primary" />
    <q-btn color="primary" outline label="Show JSON Preview" @click="showDialog = true" />
  </div>

</q-form>


      <q-dialog v-model="showDialog" persistent>
        <q-card style="min-width: 70vw; max-width: 90vw;">
          <q-card-section>
            <div class="text-h6">Execute Request Confirmation</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-banner dense class="bg-grey-2 text-black q-pa-sm">
              This is the full request that will be sent to the Execute endpoint:
            </q-banner>
            <q-input
              v-model="jsonRequestPreview"
              label="execute request"
              type="textarea"
              @change="jsonRequestPreview = $event.target.value"
              required
            />
            <!-- <pre class="q-pa-sm scroll bg-grey-2" style="max-height: 400px; overflow-y: auto; white-space: pre-wrap;">
      {{ jsonRequestPreview }}
            </pre> -->
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
            <q-btn
              label="Submit Request"
              color="primary"
              :loading="loading"
              @click="() => { showDialog = false; submitProcess() }"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <div class="q-mt-md" v-if="loading">
        <q-linear-progress indeterminate color="primary" />
        <div class="text-caption text-primary q-mt-sm">Execution in progress... Status: {{ jobStatus }}</div>
      </div>

      <div class="q-mt-lg" v-if="response">
        <h6>Execution Response</h6>
        <details>
          <summary class="text-primary text-bold cursor-pointer">Show Raw JSON</summary>
          <pre>{{ JSON.stringify(response, null, 2) }}</pre>
        </details>
      </div>
    </div>
    <q-spinner v-else />
  </q-page>
</template>