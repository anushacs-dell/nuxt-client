<script setup lang="ts">
import { ref, onMounted, watch, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useRuntimeConfig } from '#imports'
import { triggerRef } from 'vue'
import { uuid } from 'vue-uuid';
import { useQuasar } from 'quasar'
import HelpDialog from '@/components/help/HelpDialog.vue'
import processIdHelp from '@/components/help/processIdHelp.js'


import { uuid } from 'vue-uuid'

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
const requiredInputs = ref<string[]>([])
const inputRefs = ref<Record<string, HTMLElement | null>>({})
const validationErrors = ref<Record<string, boolean>>({})
const progressPercent = ref(0)
const progressMessage = ref('')
const jobId = ref("");
const channelId = ref(uuid.v1());

const $q = useQuasar()
let ws: WebSocket | null = null
const helpVisible = ref(false)
const helpContent = processIdHelp

const subscriberValues = ref({
  successUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-' + channelId.value + '&type=success',
  inProgressUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-' + channelId.value + '&type=inProgress',
  failedUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-' + channelId.value + '&type=failed'
})


// Detects whether a schema describes complex content (has contentMediaType / mediaType / oneOf with contentMediaType)
const hasContentMedia = (schema: any) =>
  !!(
    schema?.contentMediaType ||
    schema?.mediaType ||
    (Array.isArray(schema?.oneOf) && schema.oneOf.some((f: any) => !!f?.contentMediaType))
  )

// Collect supported formats (oneOf contentMediaType or contentMediaType field). Ensure application/json is present.
const getSupportedFormats = (schema: any): string[] => {
  const list: string[] = []

  if (Array.isArray(schema?.oneOf)) {
    for (const f of schema.oneOf) {
      if (f?.contentMediaType) list.push(f.contentMediaType)
      else if (f?.type === 'object') list.push('application/json')
    }
  }

  if (schema?.contentMediaType) list.push(schema.contentMediaType)
  if (schema?.mediaType) list.push(schema.mediaType)

  if (!list.includes('application/json')) list.push('application/json')
  // unique
  return Array.from(new Set(list))
}


// Provide a readable label for the q-badge (so complex shows the media type OR href/value mode)
const typeLabel = (input: any, valForInputId: any) => {
  if (hasContentMedia(input.schema)) {
    // Handle array case (multiple complex inputs)
    if (Array.isArray(valForInputId)) {
      const item = valForInputId[0]
      if (item?.mode === 'href') return 'complex (provide URL)'
      if (item?.mode === 'value') {
        const fmt = item?.format
        return fmt ? `complex (${fmt})` : 'Provide Value Inline'
      }
    }
    // Handle single complex input
    else if (valForInputId && typeof valForInputId === 'object') {
      if (valForInputId.mode === 'href') return 'complex (provide URL)'
      if (valForInputId.mode === 'value') {
        const fmt = valForInputId?.format
        return fmt ? `complex (${fmt})` : 'Provide Value Inline'
      }
    }
    return 'complex'
  }
  return input?.schema?.type || 'literal'
}





const subscriberValues = ref({
  successUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-'+channelId.value+'&type=success',
  inProgressUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-'+channelId.value+'&type=inProgress',
  failedUri: 'http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-'+channelId.value+'&type=failed'
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
        if (input.minOccurs === undefined && input.maxOccurs === undefined) {
          requiredInputs.value.push(key)
        }


        // COMPLEX input (single or oneOf/contentMediaType)
        if (hasContentMedia(input.schema)) {
          const supportedFormats = getSupportedFormats(input.schema)

        // Complex input
        if (
          input?.schema?.contentMediaType ||
          input?.schema?.mediaType ||
          (input?.schema?.oneOf?.some(f => f.contentMediaType))
        ) {
          const supportedFormats = (
            input.schema.oneOf?.map(f => f.contentMediaType).filter(Boolean) || []
          );

          if (!supportedFormats.includes('application/json')) {
            supportedFormats.push('application/json');
          }

          const hrefOptions = input?.example?.hrefOptions || []

          if (input.maxOccurs && input.maxOccurs > 1) {
            // multiple allowed → array
            inputValues.value[key] = [
              {
                mode: hrefOptions.length > 0 ? 'href' : 'value',
                href: '',
                value: '',
                format: supportedFormats[0],
                availableFormats: supportedFormats,
                hrefOptions
              }
            ]
          } else {
            // single input → object
            inputValues.value[key] = {
              mode: hrefOptions.length > 0 ? 'href' : 'value',
              href: '',
              value: '',
              format: supportedFormats[0],
              availableFormats: supportedFormats,
              hrefOptions
            }
          }
          continue
        }


        // COMPLEX ARRAY input
        if (input.schema?.type === 'array' && hasContentMedia(input.schema.items)) {
          const supportedFormats = getSupportedFormats(input.schema.items)
          inputValues.value[key] = [
            {
              mode: 'value',
              href: '',
              value: '',
              format: supportedFormats[0],
              availableFormats: supportedFormats
            }
          ]
          continue
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


        // Multiple literal inputs (array but not complex)
        // Multiple inputs (array)

        if (input.schema?.type === 'array') {
          inputValues.value[key] = ['']
          continue
        }


        // Default init for literal input
        inputValues.value[key] = input.schema?.default ?? (input.schema?.type === 'number' ? 0 : '')
      }
    }

    // Outputs initialization
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



watch([inputValues, outputValues, subscriberValues], ([newInputs, newOutputs, newSubscribers]) => {
  console.log('Outputs changed:', newOutputs)

  const formattedInputs: Record<string, any> = {}


  for (const [key, val] of Object.entries(newInputs)) {
    // If multiple inputs (array)
    if (Array.isArray(val)) {
      // If it's a literal string/number array → just return plain values
      if (val.every(v => typeof v === "string" || typeof v === "number")) {
        formattedInputs[key] = val
      } else {
        // Complex array case (with mode/value/format)
        formattedInputs[key] = val.map((v: any) => {
          if (v && typeof v === "object" && "mode" in v) {
            if (v.mode === "href") return { href: v.href }
            return { value: v.value, format: { mediaType: v.format } }
          }
          return v
        })
      }
    }
    else if (val && typeof val === 'object' && 'mode' in val) {
      formattedInputs[key] = val.mode === 'href'
        ? { href: val.href }
        : { value: val.value, format: { mediaType: val.format?.mediaType ?? val.format } }
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


const listenToWebSocket = (jobId: string) => {
  const wsUrl = `ws://${window.location.hostname}:8888/`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connected");
    const subscriptionId = jobId.startsWith("JOBSOCKET-") ? jobId : `JOBSOCKET-${jobId}`;
    ws.send("SUB " + subscriptionId);
    console.log("Subscribed to:", subscriptionId);
  };

  ws.onmessage = (event) => {
    console.log("Raw WebSocket message:", event.data);

    // Only handle updates (handshake is not used to create jobs anymore)
    if (event.data === "1") {
      console.log("Server handshake received – waiting for job updates...");
      return;
    }

    try {
      const message = JSON.parse(event.data);

      if (!message.jobid || message.jobid.replace(/^JOBSOCKET-/, "") !== jobId) {
        console.warn("Mismatched or missing job ID in message:", message);
        return;
      }

      
      if (message.type === "success" || message.status === "successful") {
        response.value = message;
        jobStatus.value = "successful";
        loading.value = false;
        progressPercent.value = 100;
        progressMessage.value = "Completed successfully";
        ws.close();
      } else if (message.type === "failed" || message.status === "failed") {
        response.value = { error: "Job failed", details: message };
        jobStatus.value = "failed";
        loading.value = false;
        progressMessage.value = "Execution failed";
        ws.close();
      } else {
        jobStatus.value = "running...";
        progressPercent.value = message.progress ?? progressPercent.value;
        progressMessage.value = message.message ?? message.statusText ?? progressMessage.value;
      }
    } catch (e) {
      console.error("Invalid WebSocket message format:", event.data);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error", err);
    ws.close();
  };
};





const validateRequiredInputs = (): boolean => {
  for (const inputId of requiredInputs.value) {
    const val = inputValues.value[inputId]


    if (val === undefined || val === '' || (Array.isArray(val) && val.every(v => !v.value && !v.href))) {
      return false
    }


    // Bounding box case
    if (val && typeof val === 'object' && 'bbox' in val) {
      if (val.bbox.some(coord => coord === null || coord === undefined || coord === '')) {
        return false
      }
    }
  }



  return true
}



  return true
}


function setInputRef(id: string, el: HTMLElement | null) {
  if (el) {
    inputRefs.value[id] = el
  }
}



function validateAndSubmit() {
  validationErrors.value = {}


  let firstInvalid: string | null = null



function validateAndSubmit() {
  validationErrors.value = {}

  let firstInvalid: string | null = null


  for (const key of requiredInputs.value) {
    const value = inputValues.value[key]
    const isEmpty = Array.isArray(value) ? value.length === 0 : !value


    if (isEmpty) {
      validationErrors.value[key] = true
      if (!firstInvalid) firstInvalid = key
    }
  }


  if (firstInvalid) {
    const el = inputRefs.value[firstInvalid]
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }



  submitProcess()
}



  submitProcess()
}


const submitProcess = async () => {
  if (!validateRequiredInputs()) {
    $q.notify({
      type: "negative",
      message: "Please fill all required inputs before submitting.",
    });
    return;
  }


  loading.value = true;
  response.value = null;
  jobStatus.value = "submitted";
  progressPercent.value = 0;
  progressMessage.value = "Submitting job...";

  const wsUrl = `ws://${window.location.hostname}:8888/;`

  // subscriber URLs for async only
  const subscribers = {
    successUri: `http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-${channelId.value}&type=success`,
    inProgressUri: `http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-${channelId.value}&type=inProgress`,
    failedUri: `http://zookernel/cgi-bin/publish.py?jobid=JOBSOCKET-${channelId.value}&type=failed`,
  };

  try {
    const originalPayload = JSON.parse(jsonRequestPreview.value || "{}");
    if (preferMode.value === "respond-async") {
      originalPayload.executionOptions = originalPayload.executionOptions ?? {};
      originalPayload.executionOptions.subscriber = { ...subscribers };
    }
    console.log("Submitting payload:", JSON.stringify(originalPayload, null, 2));

    const res = await $fetch(
      `${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}/execution`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authStore.token.access_token}`,
          "Content-Type": "application/json",
          Prefer: preferMode.value,
        },
        body: JSON.stringify(originalPayload),
      }
    );

   
    if (preferMode.value === "respond-async") {
      //  Async execution (requires jobID + websocket updates)
      if (!res || !res.jobID) {
        throw new Error("Expected async response with jobID, but got none");
      }

      jobId.value = res.jobID;
      console.log(" Job submitted (server jobID):", res.jobID);

      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log(" WebSocket connected — subscribing to", "JOBSOCKET-" + channelId.value);
        ws.send("SUB JOBSOCKET-" + channelId.value);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log(" WS message:", msg);

          const msgJobId = msg.jobid ?? msg.jobID ?? null;
          const msgId = msg.id ?? null;

          if (msgJobId !== "JOBSOCKET-" + channelId.value && msgId !== jobId.value) {
            console.log("Ignored WS message, not for this job:", msgJobId, msgId);
            return;
          }

          // handle progress
          if (msg.progress !== undefined) progressPercent.value = msg.progress;
          if (msg.message) progressMessage.value = msg.message;


          if (msg.status === "succeeded" || msg.type === "success") {
            progressPercent.value = 100;
            progressMessage.value = "Completed successfully";
            jobStatus.value = "successful";
            response.value = msg;
            loading.value = false;
            ws?.close();
          } else if (msg.status === "failed" || msg.type === "failed") {
            progressMessage.value = "Execution failed";
            jobStatus.value = "failed";
            response.value = { error: "Job failed", details: msg };
            loading.value = false;
            ws?.close();
          } else {
            jobStatus.value = "running...";
          }
        } catch (e) {
          console.error(" Invalid WS message:", event.data, e);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        progressMessage.value = "WebSocket error";
      };

    } else {
      //  Sync execution (result returned immediately)
      console.log(" Sync execution result:", res);

      //  Check if error response
      if (res.error) {
        console.error(" Sync execution error:", res.error);
        progressMessage.value = res.error.description || "Execution failed";
        jobStatus.value = "failed";
        response.value = res;
      } else if (res.status) {
        // If server included a status field
        if (res.status === "succeeded") {
          progressPercent.value = 100;
          progressMessage.value = "Completed successfully";
          jobStatus.value = "successful";
        } else if (res.status === "failed") {
          progressMessage.value = "Execution failed";
          jobStatus.value = "failed";
        }
        response.value = res;
      } else {
        // No status - treat as successful raw result
        progressPercent.value = 100;
        progressMessage.value = "Completed successfully (sync)";
        jobStatus.value = "successful";
        response.value = res;
      }

      loading.value = false;
    }
  } catch (error) {
    console.error("Execution error (POST):", error);
    $q.notify({ type: "negative", message: "Process execution failed." });
    jobStatus.value = "failed";
    progressMessage.value = "Execution failed";
    loading.value = false;
  }
};




  try {
    loading.value = true
    response.value = null
    jobStatus.value = 'submitted'

    // Update the payload BEFORE submission
    const originalPayload = JSON.parse(jsonRequestPreview.value)

    // If async mode, include the real subscriber URIs
    if (preferMode.value === 'respond-async') {
      originalPayload.executionOptions = {
        subscriber: {
          ...subscriberValues.value
        }
      }
    }
      // Start WebSocket listener
      listenToWebSocket(channelId.value);

    // Submit execution request
    const res = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}/execution`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': preferMode.value
      },
      body: JSON.stringify(originalPayload)
    });

    if (res.jobID) {
      const jobId = res.jobID.replace(/^JOBSOCKET-/, '');

      // Update subscriber URIs (can be used for logs or retry logic if needed)
      subscriberValues.value = {
        successUri: `http://zookernel/cgi-bin/publish.py?jobid=${jobId}&type=success`,
        inProgressUri: `http://zookernel/cgi-bin/publish.py?jobid=${jobId}&type=inProgress`,
        failedUri: `http://zookernel/cgi-bin/publish.py?jobid=${jobId}&type=failed`
      }; 

    } else {
      // For sync responses or if no job ID is returned
      response.value = res;
      jobStatus.value = 'successful';
    }
  } catch (error) {
    console.error('Execution error:', error);
    $q.notify({
      type: 'negative',
      message: 'Process execution failed.'
    });
    jobStatus.value = 'failed';
    loading.value = false;
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



  triggerRef(inputValues)
}


const removeInputField = (inputId: string, index: number) => {
  if (Array.isArray(inputValues.value[inputId]) && inputValues.value[inputId].length > 1) {
    inputValues.value[inputId].splice(index, 1)
    triggerRef(inputValues)
  }
}

</script>





</script>


<template>
  <div>
    <q-btn
      flat
      icon="help_outline"
      color="primary"
      label="Help"
      @click="helpVisible = true"
      class="q-mb-md"
    />
    
    <HelpDialog
      v-model="helpVisible"
      :help-content="helpContent"
    />
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


      <q-form @submit.prevent="validateAndSubmit">



      <!-- <h4>{{ data.id }} - {{ data.description }}</h4> -->

      <q-form @submit.prevent="validateAndSubmit">


        <div class="q-mb-lg">
          <div class="text-h4 text-weight-bold text-primary q-mb-sm">
            Inputs
          </div>
          <q-separator class="q-mt-md" />
        </div>


        <div v-for="(input, inputId) in data.inputs" :key="inputId" class="q-mb-md">
          <q-card class="q-pa-md" :ref="el => setInputRef(inputId, el)">
            <div class="row items-center q-mb-sm">
              <div class="text-blue text-bold">
                {{ inputId.toUpperCase() }}
                <span v-if="requiredInputs.includes(inputId)" class="text-red">*</span>
              </div>
            </div>


            <!-- <div class="text-blue text-bold q-mb-sm">{{ inputId.toUpperCase() }}</div> -->
            <div class="q-gutter-sm">
              <q-badge color="grey-3" text-color="black" class="q-mb-sm">
                {{ typeLabel(input, inputValues[inputId]) }}
              </q-badge>


              <!-- Complex Input (Multiple or Single) -->
              <template v-if="isComplexInput(input)">
                <!-- Multiple Complex Input -->
                <template v-if="Array.isArray(inputValues[inputId])">
                  <div v-for="(item, idx) in inputValues[inputId]" :key="idx" class="q-gutter-sm q-mb-md">
                    <q-option-group
                      v-model="item.mode"
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

                    <!-- Remove button -->
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

                  <!-- Add button -->
                  <q-btn
                    v-if="isMultipleInput(input)"
                    flat
                    icon="add"
                    label="Add Another"
                    @click="addInputField(inputId)"
                    size="sm"
                    class="q-mt-sm"
                  />
                </template>

                <!-- Single Complex Input -->
                <template v-else>

              <!-- Complex + Multiple input -->
              <template v-if="isComplexInput(input) && Array.isArray(inputValues[inputId])">
                <div
                  v-for="(item, idx) in inputValues[inputId]"
                  :key="idx"
                  class="q-gutter-sm q-mb-md"
                >

                  <q-option-group
                    v-model="inputValues[inputId].mode"
                    :options="[
                      { label: 'Provide URL (href)', value: 'href' },
                      { label: 'Provide Value Inline', value: 'value' }
                    ]"
                    type="radio"
                    inline
                  />

                  <template v-if="inputValues[inputId].mode === 'href'">

                  <template v-if="item.mode === 'href'">

                    <q-option-group
                      v-if="inputValues[inputId].hrefOptions && inputValues[inputId].hrefOptions.length > 0"
                      v-model="inputValues[inputId].href"
                      :options="inputValues[inputId].hrefOptions.map(h => ({ label: h, value: h }))"
                      type="radio"
                      inline
                    />
                    <q-input
                      v-else
                      v-model="inputValues[inputId].href"
                      label="Reference URL (href)"
                      filled
                      dense
                    />
                  </template>

                  <div v-else>
                    <q-select
                      v-model="inputValues[inputId].format"
                      :options="inputValues[inputId].availableFormats"
                      label="Content Format"
                      dense
                      filled
                    />
                    <q-input
                      v-model="inputValues[inputId].value"
                      label="Input Value"
                      type="textarea"
                      autogrow
                      filled
                      dense
                    />
                  </div>

                </template>
              </template>




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
                  v-model="inputValues[inputId]"
                  :type="input.schema?.type === 'number' ? 'number' : 'text'"
                  :label="input.title || inputId"
                  dense
                  class="q-ml-sm"
                  style="flex: 1"
                  :error="validationErrors[inputId]"
                  :error-message="validationErrors[inputId] ? 'This field is required' : ''"
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
        <q-linear-progress
          v-if="loading"
          :value="progressPercent / 100"
          color="primary"
          class="q-mt-md"
        />
        <div class="text-caption text-primary q-mt-sm">

          <span v-if="progressMessage">{{ progressMessage }}</span>
          <span v-else>Status: {{ jobStatus }}</span>
        </div>
      </div>



          Execution in progress... Status: {{ jobStatus }}<br>
          <span v-if="progressMessage">{{ progressMessage }}</span>
        </div>
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
  </div>
</template>