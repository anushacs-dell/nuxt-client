<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRuntimeConfig } from '#imports'
import { triggerRef } from 'vue'

const {
  params: { processId }
} = useRoute()

const authStore = useAuthStore()
const config = useRuntimeConfig()

const data = ref(null)
const inputValues = ref<Record<string, Array<{ mode: 'value' | 'href', value: string, href: string }>>>({})
const outputValues = ref<Record<string, any>>({})
const response = ref(null)
const loading = ref(false)
const jobStatus = ref('')
const preferMode = ref<'respond-async' | 'respond-sync'>('respond-async')
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
        console.log(input)
        console.log('isComplexInput:', input, isComplexInput(input))

        // Complex input
        if (
          input?.schema?.contentMediaType ||
          input?.schema?.mediaType ||
          (input?.schema?.oneOf?.some(f => f.contentMediaType))
        ) {
          const supportedFormats = input.schema.oneOf?.map(f => f.contentMediaType) || DEFAULT_SUPPORTED_FORMATS;
          const hrefOptions = input?.example?.hrefOptions || []
          inputValues.value[key] = [
          {
            mode: hrefOptions.length > 0 ? 'href' : 'value',
            href: '',
            value: '',
            format: supportedFormats[0],
            availableFormats: supportedFormats,
            hrefOptions // Add this if applicable
          }
        ]
          continue;
        }

        // Bounding Box input
        if (
          input.schema?.type === 'object' &&
          input.schema?.properties?.bbox &&
          input.schema?.properties?.crs
        ) {
          inputValues.value[key] = reactive({
            bbox: [0, 0, 0, 0],
            crs: 'EPSG:4326'
          })
          continue
        }

        // Multiple inputs (array)
        if (input.schema?.type === 'array') {
          inputValues.value[key] = [
           {
              mode: 'href',
              href: '',
              value: '',
              format: supportedFormats[0],
              availableFormats: supportedFormats
            }
          ];
          continue
        }

        // Default init for literal input
        inputValues.value[key] = input.schema?.default ?? (input.schema?.type === 'number' ? 0 : '')
      }
    }
    if (data.value && data.value.outputs) {
      for (const [key, input] of Object.entries(data.value.outputs)) {
        if (input.schema.oneOf?.length > 0) {
          const myEnum = []
          for (var i = 0; i < input.schema.oneOf.length; i++) {
            if (input.schema.oneOf[i].type === "object")
              myEnum.push("application/json")
            else
              myEnum.push(input.schema.oneOf[i].contentMediaType)
          }
          outputValues.value[key] = [
            { id: "transmission", enum: ["reference", "value"], cval: "reference" },
            { id: "format", enum: myEnum, cval: myEnum[0] }
          ]
        } else {
          outputValues.value[key] = [
            { id: "transmission", enum: ["value", "reference"], cval: "value" }
          ]
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
      
      // Parcourir chaque élément du tableau
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
  console.log('Outputs changed:', newOutputs)

  const formattedInputs: Record<string, any> = {}

  for (const [key, val] of Object.entries(newInputs)) {
    // If multiple inputs (array)
    if (Array.isArray(val)) {
      formattedInputs[key] = val.map(v => {
        if (v.mode === 'href') {
          return { href: v.href }
        } else {
          return { value: v.value }
        }
      })
    } else if (val && typeof val === 'object' && 'mode' in val) {
      formattedInputs[key] = val.mode === 'href'
        ? { href: val.href }
        : { value: val.value, format: { mediaType: val.format } }
    } else {
      formattedInputs[key] = val
    }
  }

  const payload = {
    inputs: formattedInputs,
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
        'Content-Type': 'application/json',
        'Prefer': preferMode.value
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
  return input.maxOccurs && input.maxOccurs > 1
}

const isBoundingBoxInput = (input: any) => {
  return input.schema?.type === 'object' &&
         input.schema?.properties?.bbox?.type === 'array' &&
         input.schema?.properties?.crs?.type === 'string';
}

const isComplexInput = (input: any) => {
  return (
    input?.schema &&
    (
      input.schema.contentMediaType ||
      input.schema.mediaType ||
      (Array.isArray(input.schema.oneOf) && input.schema.oneOf.some(x => x.contentMediaType))
    )
  )
}

const DEFAULT_SUPPORTED_FORMATS = ['application/json', 'text/plain'] 

const addInputField = (inputId: string) => {

  if (!Array.isArray(inputValues.value[inputId])) {
    inputValues.value[inputId] = []
  }

  const currentFormats = inputValues.value[inputId][0]?.availableFormats || DEFAULT_SUPPORTED_FORMATS

  inputValues.value[inputId].push({
    mode: 'value',
    value: '',
    href: '',
    format: currentFormats[0],
    availableFormats: currentFormats
  })

  triggerRef(inputValues)
}

const removeInputField = (inputId: string, index: number) => {
  if (Array.isArray(inputValues.value[inputId]) && inputValues.value[inputId].length > 1) {
    inputValues.value[inputId].splice(index, 1)
    triggerRef(inputValues)
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
              </div>

            <!-- <div class="text-blue text-bold q-mb-sm">{{ inputId.toUpperCase() }}</div> -->
            <div class="q-gutter-sm">
              <q-badge color="grey-3" text-color="black" class="q-mb-sm">
                {{ input.schema?.type || 'text' }}
              </q-badge>

              <!-- Complex + Multiple input -->
              <template v-if="isComplexInput(input) && Array.isArray(inputValues[inputId])">
                <div
                  v-for="(item, idx) in inputValues[inputId]"
                  :key="idx"
                  class="q-gutter-sm q-mb-md"
                >
                  <q-option-group
                    v-model="inputValues[inputId][idx].mode"
                    :options="[
                      { label: 'Provide URL (href)', value: 'href' },
                      { label: 'Provide Value Inline', value: 'value' }
                    ]"
                    type="radio"
                    inline
                  />

                  <template v-if="item.mode === 'href'">
                    <q-option-group
                      v-if="item.hrefOptions && item.hrefOptions.length > 0"
                      v-model="item.href"
                      :options="item.hrefOptions.map(h => ({ label: h, value: h }))"
                      type="radio"
                      inline
                    />
                    <q-input
                      v-else
                      v-model="item.href"
                      label="Reference URL (href)"
                      filled
                      dense
                    />
                  </template>

                  <div v-else>
                    <q-select
                      v-model="item.format"
                      :options="item.availableFormats"
                      label="Content Format"
                      dense
                      filled
                    />
                    <q-input
                      v-model="item.value"
                      label="Input Value"
                      type="textarea"
                      autogrow
                      filled
                      dense
                    />
                  </div>

                  <q-btn
                    icon="delete"
                    round
                    dense
                    flat
                    color="red"
                    size="sm"
                    class="q-mt-sm"
                    @click="removeInputField(inputId, idx)"
                    v-if="inputValues[inputId].length > 1"
                  >
                    <q-tooltip>Remove</q-tooltip>
                  </q-btn>
                </div>

                <!-- Add another input button -->
                <template v-if="isMultipleInput(input)">
                  <q-btn
                    flat
                    icon="add"
                    label="Add Another"
                    @click="addInputField(inputId)"
                    size="sm"
                    class="q-mt-sm"
                  />
                </template>
              </template>

              <!-- Bounding Box Input -->
              <template v-else-if="isBoundingBoxInput(input)">
                <div class="q-gutter-md">
                  <div class="row q-gutter-sm">
                    <q-input
                      v-for="(coord, idx) in ['minX', 'minY', 'maxX', 'maxY']"
                      :key="idx"
                      v-model.number="inputValues[inputId].bbox[idx]"
                      :label="coord"
                      type="number"
                      filled
                      dense
                      style="flex: 1"
                    />
                  </div>
                  <q-select
                    v-model="inputValues[inputId].crs"
                    :options="EPSG_CODES"
                    label="EPSG Code"
                    filled
                    dense
                    class="q-mt-sm"
                  />
                </div>
              </template>

              <!-- Multiple input array -->
              <template v-else-if="Array.isArray(inputValues[inputId])">
                <div v-for="(val, idx) in inputValues[inputId]" :key="idx" class="row items-center q-gutter-sm q-mb-sm">
                  <q-input
                    filled
                    v-model="inputValues[inputId][idx]"
                    :type="input.schema?.type === 'number' ? 'number' : 'text'"
                    :label="`${input.title || inputId} ${idx + 1}`"
                    dense
                    style="flex: 1"
                  />
                  <q-btn
                    icon="delete"
                    round
                    dense
                    flat
                    color="red"
                    size="sm"
                    @click="removeInputField(inputId, idx)"
                    v-if="inputValues[inputId].length > 1"
                  >
                    <q-tooltip>Remove</q-tooltip>
                  </q-btn>
                </div>
              </template>

              <!-- Literal input (no enum) -->
              <template v-else-if="!input.schema?.enum">
                <q-input
                  filled
                  v-model="inputValues[inputId]"
                  :type="input.schema?.type === 'number' ? 'number' : 'text'"
                  :label="input.title || inputId"
                  dense
                  class="q-ml-sm"
                  style="flex: 1"
                />
              </template>

              <!-- Enum input -->
              <template v-else>
                <q-select
                  filled
                  v-model="inputValues[inputId]"
                  :options="input.schema.enum"
                  :label="input.title || inputId"
                  dense
                  class="q-ml-sm"
                  style="flex: 1"
                />
              </template>
            </div>
          </q-card>

        </div>

        <div class="q-mb-lg">
          <div class="text-h4 text-weight-bold text-primary q-mb-sm">
            Outputs
          </div>
          <q-separator class="q-mt-md" />
        </div>

        <div v-for="(output, outputId) in data.outputs" :key="outputId" class="q-mb-md">
          <q-card class="q-pa-md">
              <div class="row items-center q-mb-sm">
                <div class="text-blue text-bold">{{ outputId.toUpperCase() }}</div>
                <q-space />
              </div>
              <q-select
                filled
                v-if="outputValues[outputId].length > 1"
                v-model="outputValues[outputId][1].cval"
                :options="outputValues[outputId][1].enum"
                label="Format"
                dense
                class="q-ml-sm"
                style="flex: 1"
              >
                <template v-slot:prepend>
                  <q-icon name="description" color="blue" />
                </template>
              </q-select>
              <q-select
                filled
                v-if="outputValues[outputId].length > 0"
                v-model="outputValues[outputId][0].cval"
                :options="outputValues[outputId][0].enum"
                label="Transmission"
                dense
                class="q-ml-sm"
                style="flex: 1"
              >
              </q-select>

          </q-card>
        </div>

        <div class="q-mb-md">
          <q-card class="q-pa-md">
            <div class="row items-center q-mb-sm">
              <div class="text-blue text-bold">NOTIFICATION ENDPOINTS</div>
              <q-space />
              <q-icon name="info" color="grey-6" size="sm">
                <q-tooltip>URLs to receive status notifications</q-tooltip>
              </q-icon>
            </div>

            <div class="q-gutter-md">
              <!-- Success URI -->
              <div class="q-gutter-sm row items-center">
                <q-badge color="green" text-color="white">
                  Success
                </q-badge>
                <q-input
                  filled
                  v-model="subscriberValues.successUri"
                  label="Success URI"
                  placeholder="URL called in case of success"
                  dense
                  @change="subscriberValues.successUri = $event.target.value"
                  class="q-ml-sm"
                  style="flex: 1"
                >
                  <template v-slot:prepend>
                    <q-icon name="check_circle" color="green" />
                  </template>
                </q-input>
              </div>

              <!-- In Progress URI -->
              <div class="q-gutter-sm row items-center">
                <q-badge color="orange" text-color="white">
                  Progress
                </q-badge>
                <q-input
                  filled
                  v-model="subscriberValues.inProgressUri"
                  label="In Progress URI"
                  placeholder="URL called during execution"
                  @change="subscriberValues.inProgressUri = $event.target.value"
                  dense
                  class="q-ml-sm"
                  style="flex: 1"
                >
                  <template v-slot:prepend>
                    <q-icon name="hourglass_empty" color="orange" />
                  </template>
                </q-input>
              </div>

              <!-- Failed URI -->
              <div class="q-gutter-sm row items-center">
                <q-badge color="red" text-color="white">
                  Failed
                </q-badge>
                <q-input
                  filled
                  v-model="subscriberValues.failedUri"
                  label="Failed URI"
                  placeholder="URL called in case of failure"
                  @change="subscriberValues.failedUri = $event.target.value"
                  dense
                  class="q-ml-sm"
                  style="flex: 1"
                >
                  <template v-slot:prepend>
                    <q-icon name="error" color="red" />
                  </template>
                </q-input>
              </div>
            </div>
          </q-card>
        </div>
          <q-select
            v-model="preferMode"
            :options="['respond-async', 'respond-sync']"
            label="Execution Mode"
            filled
            dense
            class="q-mb-md"
          />
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
