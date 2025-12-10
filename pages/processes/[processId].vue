<script setup lang="ts">
import { useHead } from '#imports'
import { ref, onMounted, watch, reactive, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useRuntimeConfig } from '#imports'
import { triggerRef } from 'vue'
import { uuid } from 'vue-uuid';
import { useQuasar } from 'quasar'
import HelpDialog from '@/components/help/HelpDialog.vue'
import processIdHelp from '@/components/help/processIdHelp.js'
 
 
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
const submitting = ref(false);
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
const bboxDialogVisible = ref(false)
const editingBboxKey = ref<string | null>(null)
let map: L.Map | null = null
let drawLayer: L.LayerGroup | null = null
let drawnFeature: L.Layer | null = null
 
 
// Helper to extract a default bbox from various schema styles (old & new)
const getDefaultBbox = (schema: any) => {
  //  Try the new schema style: ogc-bbox with allOf references
  if (schema?.schema?.allOf?.some((s: any) => s.format === 'ogc-bbox')) {
    const bbox = schema?.example?.bbox || schema?.schema?.example?.bbox
    if (Array.isArray(bbox)) return bbox.slice(0, 4)
  }
 
  //  Try the old schema style: bbox.yaml references or bbox property
  if (schema?.example?.bbox && Array.isArray(schema.example.bbox)) {
    return schema.example.bbox.slice(0, 4)
  }
 
  if (schema?.properties?.bbox?.default && Array.isArray(schema.properties.bbox.default)) {
    return schema.properties.bbox.default.slice(0, 4)
  }
 
  // fallback
  return [0, 0, 0, 0]
}
 
 
const subscriberValues = ref({
  successUri: `${config.public.SUBSCRIBERURL}?jobid=JOBSOCKET-${channelId.value}&type=success`,
  inProgressUri: `${config.public.SUBSCRIBERURL}?jobid=JOBSOCKET-${channelId.value}&type=inProgress`,
  failedUri: `${config.public.SUBSCRIBERURL}jobid=JOBSOCKET-${channelId.value}&type=failed`
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
 
const fetchData = async () => {
  try {
    data.value = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`
      }
    })
 
    if (data.value && data.value.inputs) {
      for (const [key, input] of Object.entries(data.value.inputs)) {
        if (input.minOccurs !== 0) {
          requiredInputs.value.push(key)
        }
 
        // COMPLEX input (single or oneOf/contentMediaType)
        if (hasContentMedia(input.schema)) {
          const supportedFormats = getSupportedFormats(input.schema)
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
 
        // Bounding Box input — support old schema + new allOf/ogc-bbox/bbox.yaml variants
        const detectBboxFromSchema = (schema: any) => {
          if (!schema) return null;
 
          // --- Old-style bbox detection ---
          if (schema.type === 'object' && schema.properties) {
            const props = schema.properties || {};
            for (const key of Object.keys(props)) {
              const p = props[key];
              if (
                (p?.type === 'array' || p?.items) &&
                (props.crs && props.crs.type === 'string')
              ) {
                return { propName: key, crsDefault: props.crs.default ?? 'EPSG:4326' };
              }
            }
          }
 
          // --- New-style allOf detection ---
          if (Array.isArray(schema.allOf)) {
            for (const s of schema.allOf) {
              // ogc-bbox format
              if (s?.format === 'ogc-bbox') {
                return { propName: 'bbox', crsDefault: 'EPSG:4326' };
              }
              // bbox.yaml reference
              if (typeof s?.['$ref'] === 'string' && /bbox\.yaml$/i.test(s['$ref'])) {
                return { propName: 'bbox', crsDefault: 'EPSG:4326' };
              }
              // nested object schema
              const nested = detectBboxFromSchema(s);
              if (nested) return nested;
            }
          }
 
          return null;
        };
 
        const bboxInfo = detectBboxFromSchema(input.schema);
        if (bboxInfo) {
          const defaultBbox = getDefaultBbox(input);
          inputValues.value[key] = reactive({
            bbox: defaultBbox,
            crs: bboxInfo.crsDefault || 'EPSG:4326',
            _schemaPropName: bboxInfo.propName
          });
          continue;
        }
 
        // Multiple literal inputs (array but not complex)
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
 
let L: any = null

watch(
  () => data.value,
  (val) => {
    if (!val) return

    const rawMetadata = val.metadata || []

    // Extract items by role
    const extractByRole = (role) =>
      rawMetadata
        .filter(md => md.role === role)
        .map(md => md.value)

    // Authors (may be multiple)
    const authors = extractByRole("https://schema.org/author")
      .map(a => ({
        "@type": a["@type"] || "Person",
        "name": a.name || a.fullName || ""
      }))

    // Contributors 
    const contributors = extractByRole("https://schema.org/contributor")
      .map(c => ({
        "@type": c["@type"] || "Person",
        "name": c.name || c.fullName || ""
      }))

    // Organizations 
    const organizations = extractByRole("https://schema.org/organization")
      .map(org => ({
        "@type": "Organization",
        "name": org.name || ""
      }))

    // Additional metadata (anything NOT author/contributor/organization)
    const skipRoles = [
      "https://schema.org/author",
      "https://schema.org/contributor",
      "https://schema.org/organization"
    ]

    const additionalProps = rawMetadata
      .filter(md => !skipRoles.includes(md.role))
      .map(md => ({
        "@type": "PropertyValue",
        "name": md.role,
        "value": md.value
      }))

    // Build final JSON-LD
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "name": val.id,
      "description": val.description,
      "softwareVersion": val.version || null,
      "keywords": val.keywords || [],
      "identifier": processId,
      "url": `http://localhost:3058/processes/${processId}`,

      // New metadata mapping
      "author": authors,
      "contributor": contributors,
      "provider": organizations.length ? organizations[0] : {
        "@type": "Organization",
        "name": "ZOO-Project"
      },

      "additionalProperty": additionalProps
    }

    // Inject JSON-LD into <head>
    useHead({
      script: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd)
        }
      ]
    })
  },
  { immediate: true }
)

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
 
onMounted(async () => {
  if (process.client) {
    // ✅ Import only on the client
    const leaflet = await import('leaflet')
    await import('@geoman-io/leaflet-geoman-free')
    await import('@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css')
    L = leaflet.default
    await fetchData()
  }
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
 
watch(
  [inputValues, outputValues, subscriberValues],
  ([newInputs, newOutputs, newSubscribers]) => {
    console.log('Outputs changed:', newOutputs)
 
    const formattedInputs: Record<string, any> = {}
 
    for (const [key, val] of Object.entries(newInputs)) {
      if (
        val === undefined ||
        val === '' ||
        (Array.isArray(val) && val.every(v => !v || (typeof v === 'object' && !v.value && !v.href))) ||
        (typeof val === 'object' && 'mode' in val && !val.value && !val.href)
      ) {
        continue
      }
 
      // ✅ ADD THIS: handle Bounding Box inputs first
      if (val && typeof val === 'object' && 'bbox' in val) {
        formattedInputs[key] = {
          bbox: val.bbox,
          crs: val.crs || 'EPSG:4326'
        }
        continue
      }
 
      // If multiple inputs (array)
      if (Array.isArray(val)) {
        if (val.every(v => typeof v === 'string' || typeof v === 'number')) {
          formattedInputs[key] = val
        } else {
          formattedInputs[key] = val
            .filter(v => v.value || v.href) // only keep filled
            .map(v =>
              v.mode === 'href'
                ? { href: v.href }
                : { value: v.value, format: { mediaType: v.format } }
            )
        }
      } else if (val && typeof val === 'object' && 'mode' in val) {
        if (val.mode === 'href' && val.href) {
          formattedInputs[key] = { href: val.href }
        } else if (val.mode === 'value' && val.value) {
          formattedInputs[key] = {
            value: val.value,
            format: { mediaType: val.format?.mediaType ?? val.format }
          }
        }
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
  },
  { deep: true }
)
 
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
 
function setInputRef(id: string, el: HTMLElement | null) {
  if (el) {
    inputRefs.value[id] = el
  }
}
 
function validateAndSubmit() {
  validationErrors.value = {}
 
  let firstInvalid: string | null = null
 
  for (const key of requiredInputs.value) {
    const value = inputValues.value[key]
    let isEmpty = false
 
    if (isEmpty) {
      validationErrors.value[key] = true
      if (!firstInvalid) firstInvalid = key
    }
  }
 
  if (firstInvalid) {
    // show notification here
    $q.notify({
      type: "negative",
      message: "Please fill all required inputs before submitting."
    })
 
    const el = inputRefs.value[firstInvalid]
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }
 
  submitProcess()
}
 
 
const submitProcess = async () => {
  if (loading.value || submitting.value) {
    return;
  }
 
  if (!validateRequiredInputs()) {
    $q.notify({
      type: "negative",
      message: "Please fill all required inputs before submitting.",
    });
    return;
  }
 
 
  response.value = null;
  jobStatus.value = "submitted";
  progressPercent.value = 0;
  progressMessage.value = "Submitting job...";
 
    let wsUrl = "";
    if (typeof window !== "undefined") {
      wsUrl = `ws://${window.location.hostname}:8888/`;
    }
 
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
      loading.value = true;
    }else{
      submitting.value = true;
    }
 
    const res = await $fetch(
      `${config.public.NUXT_ZOO_BASEURL}/ogc-api/processes/${processId}/execution`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authStore.token.access_token}`,
          "Content-Type": "application/json",
          Prefer: preferMode.value+(preferMode.value=="respond-async"?";return=representation":""),
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
            if(event.data!="1"){
              progressPercent.value = 100;
              progressMessage.value = "Completed successfully";
              response.value = JSON.parse(event.data);
              loading.value = false;
              ws?.close();
            }else
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
      } else {
        // No status - treat as successful raw result
        progressPercent.value = 100;
        progressMessage.value = "Completed successfully (sync)";
        jobStatus.value = "successful";
        response.value = res;
      }
 
 
    }
  } catch (error) {
    console.error("Execution error (POST):", error);
    $q.notify({ type: "negative", message: "Process execution failed." });
    jobStatus.value = "failed";
    progressMessage.value = "Execution failed";
    loading.value = false;
  } finally {
    submitting.value = false;
  }
};
 
 
 
 
const isMultipleInput = (input: any) => {
  return input.maxOccurs && input.maxOccurs > 1
}
 
const isBoundingBoxInput = (input: any): boolean => {
  if (!input?.schema) return false;
  const schema = input.schema;
 
  // Old-style
  if (schema.type === 'object' && schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (
        (prop as any)?.type === 'array' ||
        (prop as any)?.items
      ) {
        if (schema.properties?.crs?.type === 'string') return true;
      }
    }
  }
 
  // New-style (allOf with ogc-bbox or bbox.yaml)
  if (Array.isArray(schema.allOf)) {
    return schema.allOf.some(s =>
      s?.format === 'ogc-bbox' ||
      (typeof s?.['$ref'] === 'string' && /bbox\.yaml$/i.test(s['$ref'])) ||
      (s?.type === 'object' && isBoundingBoxInput({ schema: s }))
    );
  }
 
  return false;
};
 
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
 
//  Open map popup for editing bounding box
const openBboxPopup = (inputKey: string) => {
  editingBboxKey.value = inputKey
  bboxDialogVisible.value = true
  nextTick(() => initMap())
}
 
const initMap = () => {
  if (!process.client || !L) return
  const mapContainer = document.getElementById('bbox-map')
  if (!mapContainer) return
 
  if (map) {
    map.off()
    map.remove()
    map = null
  }
 
  //  Initialize map
  map = L.map('bbox-map').setView([25.2, 55.3], 4) // default center (adjust as needed)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)
 
  //  Add Geoman controls
  map.pm.addControls({
    position: 'topleft',
    drawCircle: false,
    drawMarker: false,
    drawPolygon: false,
    drawPolyline: false,
    drawCircleMarker: false,
    drawText: false,
    drawRectangle: true,
    editMode: true,
    dragMode: false,
    cutPolygon: false,
    removalMode: true
  })
 
  // Layer to hold drawings
  drawLayer = L.layerGroup().addTo(map)
 
  // draw current bbox for editing (convert to 4326 for Leaflet if needed)
  const current = editingBboxKey.value ? inputValues.value[editingBboxKey.value] : null
    if (current && Array.isArray(current.bbox) && current.bbox.length === 4) {
    const crs = current.crs || 'EPSG:4326'
    if (crs !== 'EPSG:4326') {
      ensureProj4().then(() => {
        try {
          const sw = proj4(crs, 'EPSG:4326', [current.bbox[0], current.bbox[1]])
          const ne = proj4(crs, 'EPSG:4326', [current.bbox[2], current.bbox[3]])
          const displayBbox = [
            Math.min(sw[0], ne[0]),
            Math.min(sw[1], ne[1]),
            Math.max(sw[0], ne[0]),
            Math.max(sw[1], ne[1])
          ].map(Number)
          drawBboxOnMap(displayBbox)
        } catch (e) {
          console.warn('Could not convert bbox to 4326 for display', e)
        }
      })
    } else {
      drawBboxOnMap(current.bbox.map(Number))
    }
  }
  //  Handle rectangle draw event
  map.on('pm:create', e => {
    // remove existing drawnFeature (only one bbox supported)
    if (drawnFeature) {
      try { drawLayer.removeLayer(drawnFeature) } catch (err) {}
      drawnFeature = null
    }
 
    drawnFeature = e.layer
    drawLayer.addLayer(drawnFeature)
 
    // Ensure the new layer is editable right away
    if (drawnFeature.pm && typeof drawnFeature.pm.enable === 'function') {
      drawnFeature.pm.enable({ allowSelfIntersection: false })
    }
 
    // update the bbox value from the new layer
    updateBboxFromLayer()
 
    // attach edit/remove handlers to keep inputValues in sync
    drawnFeature.on('pm:edit', () => updateBboxFromLayer())
    drawnFeature.on('pm:remove', () => {
      if (editingBboxKey.value) {
        inputValues.value[editingBboxKey.value].bbox = [0, 0, 0, 0]
      }
      drawnFeature = null
    })
  })
 
}
 

// Replace existing updateBboxFromLayer() with this code
const updateBboxFromLayer = async () => {
  if (!drawnFeature || !editingBboxKey.value) return;

  const bounds = drawnFeature.getBounds();
  // Leaflet provides lon/lat in these values (we treat as EPSG:4326)
  const bbox4326 = [
    Number(bounds.getWest().toFixed(6)),  // minx (lon)
    Number(bounds.getSouth().toFixed(6)), // miny (lat)
    Number(bounds.getEast().toFixed(6)),  // maxx (lon)
    Number(bounds.getNorth().toFixed(6))  // maxy (lat)
  ];

  // Get the desired / user-selected CRS for this input (normalize to EPSG:####)
  let desiredCrs = (inputValues.value[editingBboxKey.value]?.crs || 'EPSG:4326').toString();
  if (/^\d+$/.test(desiredCrs)) desiredCrs = `EPSG:${desiredCrs}`;
  if (!/^EPSG:/i.test(desiredCrs)) desiredCrs = `EPSG:${desiredCrs}`;

  // If desired is not 4326 we must convert the drawn (4326) bbox to desiredCrs
  if (desiredCrs !== 'EPSG:4326') {
    try {
      await ensureProj4(); // loader already present in your file
      // Ensure proj defs are known (reuse logic from reprojectBbox if needed)
      // Convert SW and NE corner from 4326 -> desiredCrs
      const sw = proj4('EPSG:4326', desiredCrs, [bbox4326[0], bbox4326[1]]);
      const ne = proj4('EPSG:4326', desiredCrs, [bbox4326[2], bbox4326[3]]);

      // Build min/max in target CRS (in case coords swapped)
      const converted = [
        Math.min(sw[0], ne[0]),
        Math.min(sw[1], ne[1]),
        Math.max(sw[0], ne[0]),
        Math.max(sw[1], ne[1])
      ].map(Number);

      // Save in inputValues using the user-selected CRS
      if (!inputValues.value[editingBboxKey.value]) {
        inputValues.value[editingBboxKey.value] = { bbox: converted, crs: desiredCrs, _schemaPropName: 'bbox' };
      } else {
        inputValues.value[editingBboxKey.value].bbox = converted;
        inputValues.value[editingBboxKey.value].crs = desiredCrs;
      }
    } catch (e) {
      console.error('Could not reproject drawn bbox to desired CRS', desiredCrs, e);
      // fallback: store as EPSG:4326 (old behaviour) but notify user
      inputValues.value[editingBboxKey.value].bbox = bbox4326;
      inputValues.value[editingBboxKey.value].crs = 'EPSG:4326';
      $q.notify({ type: 'warning', message: `Could not convert bbox to ${desiredCrs}. Saved as EPSG:4326.` });
    }
  } else {
    // desired is EPSG:4326 — no reprojection needed
    if (!inputValues.value[editingBboxKey.value]) {
      inputValues.value[editingBboxKey.value] = { bbox: bbox4326, crs: 'EPSG:4326', _schemaPropName: 'bbox' };
    } else {
      inputValues.value[editingBboxKey.value].bbox = bbox4326;
      inputValues.value[editingBboxKey.value].crs = 'EPSG:4326';
    }
  }
};
 
 
 
const closeBboxPopup = () => {
  bboxDialogVisible.value = false
  editingBboxKey.value = null
}
 
const confirmBboxSelection = () => {
  if (editingBboxKey.value && inputValues.value[editingBboxKey.value]?.bbox) {
    console.log('Confirmed bbox:', inputValues.value[editingBboxKey.value].bbox)
  }
  closeBboxPopup()
}
 
// ----- reprojection helpers -----
let proj4: any = null
 
// ensure proj4 loaded on client
const ensureProj4 = async () => {
  if (proj4) return proj4
  if (!process.client) throw new Error('proj4 can only be loaded on client')
  const mod = await import('proj4')
  proj4 = mod.default ?? mod
  return proj4
}
 
/**
 * Fetch a proj4 definition (text like "+proj=...") for a given EPSG code
 * using epsg.io proj4 endpoint as fallback. Returns a proj4 definition string or null.
 * Example: fetchProjDef("EPSG:3857") => "+proj=...".
 */
const fetchProjDef = async (epsgCode: string): Promise<string | null> => {
  // Normalize input (accept "EPSG:4326" or "4326")
  let code = (epsgCode || '').toString()
  if (/^\d+$/.test(code)) code = `EPSG:${code}`
  if (!/^EPSG:/i.test(code)) code = `EPSG:${code}`
 
  try {
    // epsg.io provides a proj4 text endpoint at https://epsg.io/<code>.proj4
    // e.g. https://epsg.io/3857.proj4 returns proj4 string for EPSG:3857
    const numeric = code.split(':')[1]
    const res = await fetch(`https://epsg.io/${numeric}.proj4`)
    if (!res.ok) return null
    const text = await res.text()
    if (text && text.trim().length > 0) return text.trim()
    return null
  } catch (e) {
    console.warn('Could not fetch proj def for', code, e)
    return null
  }
}
 
/**
 * Reproject a bbox from 'fromCrs' to 'toCrs'.
 * bbox expected as [minx,miny,maxx,maxy].
 * Returns new bbox [minx,miny,maxx,maxy].
 */
const reprojectBbox = async (inputKey: string, fromCrs: string, toCrs: string) => {
  if (!inputKey) return
 
  try {
    await ensureProj4()
    // Normalize codes
    const f = (fromCrs || 'EPSG:4326').toString().replace(/^epsg:/i, 'EPSG:')
    const t = (toCrs || 'EPSG:4326').toString().replace(/^epsg:/i, 'EPSG:')
 
    // If proj4 already knows the code, use directly; otherwise fetch def and register alias.
    const ensureDef = async (code: string) => {
      const numeric = code.split(':')[1]
      // proj4 has built-ins for common codes (EPSG:4326, EPSG:3857). Test if it resolves.
      try {
        // try a dummy transform to see if proj4 knows it
        proj4(code, code, [0, 0])
        return code
      } catch (e) {
        // not known — try fetch
      }
      const def = await fetchProjDef(code)
      if (def) {
        proj4.defs(code, def)
        return code
      } else {
        console.warn('No proj definition for', code)
        return null
      }
    }
 
    const fCode = await ensureDef(f)
    const tCode = await ensureDef(t)
    if (!fCode || !tCode) {
      $q.notify({ type: 'warning', message: `Projection definition missing for ${!fCode ? f : t}. Reprojection skipped.` })
      return
    }
 
    const input = inputValues.value[inputKey]
    if (!input || !Array.isArray(input.bbox) || input.bbox.length < 4) return
 
    const [minx, miny, maxx, maxy] = input.bbox.map(Number)
 
    // Reproject the four corners
    const corners = [
      [minx, miny],
      [minx, maxy],
      [maxx, miny],
      [maxx, maxy]
    ]
 
    const reprojected = corners.map(([x, y]) => {
      try {
        const out = proj4(fCode, tCode, [x, y])
        return [Number(out[0]), Number(out[1])]
      } catch (e) {
        console.error('proj4 transform failed', e)
        return [NaN, NaN]
      }
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]))
 
    if (reprojected.length === 0) {
      $q.notify({ type: 'negative', message: 'Reprojection failed: no valid corner points' })
      return
    }
 
    const xs = reprojected.map(c => c[0])
    const ys = reprojected.map(c => c[1])
    const newBbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(Number)
 
    // Update the inputValues with new bbox and the new crs
    inputValues.value[inputKey].bbox = newBbox
    inputValues.value[inputKey].crs = tCode
 
    // If map open, update drawn rectangle to reflect reprojected bbox (Leaflet expects lat/lng)
    // We'll convert to EPSG:4326 for Leaflet display if needed
    if (map) {
      // If target CRS is not EPSG:4326, transform to 4326 for display
      if (tCode !== 'EPSG:4326') {
        const displayPts = [
          [newBbox[0], newBbox[1]],
          [newBbox[2], newBbox[3]]
        ].map(pt => proj4(tCode, 'EPSG:4326', pt))
        const displayBbox = [
          Math.min(displayPts[0][0], displayPts[1][0]),
          Math.min(displayPts[0][1], displayPts[1][1]),
          Math.max(displayPts[0][0], displayPts[1][0]),
          Math.max(displayPts[0][1], displayPts[1][1])
        ].map(Number)
        drawBboxOnMap(displayBbox)
      } else {
        drawBboxOnMap(newBbox)
      }
    }
 
  } catch (e) {
    console.error('reprojectBbox error', e)
    $q.notify({ type: 'negative', message: 'Reprojection failed (see console)' })
  }
}
 
// helper to draw bbox rectangle on Leaflet map (bbox in EPSG:4326 lat/lon expected)
const drawBboxOnMap = (bbox4326: number[]) => {
  if (!map || !drawLayer) return
 
  // ensure numeric values (sometimes they are strings)
  const nums = bbox4326.map(n => Number(n))
  if (nums.some(n => Number.isNaN(n))) return
 
  // remove previous drawn
  if (drawnFeature) {
    try { drawLayer.removeLayer(drawnFeature) } catch (e) { /* ignore */ }
    drawnFeature = null
  }
 
  // bbox4326 expected [minx,miny,maxx,maxy] where x=lon, y=lat
  const [minx, miny, maxx, maxy] = nums
  const bounds = [[miny, minx], [maxy, maxx]] // leaflet: [[southWestLat, westLng], [northEastLat, eastLng]]
 
  // create rectangle and add to drawLayer
  drawnFeature = L.rectangle(bounds)
  drawLayer.addLayer(drawnFeature)
 
  // enable Geoman editing for this layer (so user can drag corners later)
  if (drawnFeature.pm && typeof drawnFeature.pm.enable === 'function') {
    drawnFeature.pm.enable({ allowSelfIntersection: false })
  } else if (map.pm && map.pm.enableGlobalEditMode) {
    // fallback: enable map-level edit mode (not ideal but safer)
    // map.pm.enableGlobalEditMode()
  }
 
  // wire edit events on the layer so changes update the bounding box in inputValues
  drawnFeature.on('pm:edit', () => updateBboxFromLayer())
  drawnFeature.on('pm:remove', () => {
    if (editingBboxKey.value) {
      inputValues.value[editingBboxKey.value].bbox = [0, 0, 0, 0]
    }
    drawnFeature = null
  })
 
  // fit map to the rectangle
  try {
    map.fitBounds(bounds, { maxZoom: 12 })
  } catch (e) {
    console.warn('fitBounds failed', e)
  }
}
 
// Watch for changes to bbox crs values and reproject when user changes it
watch(
  inputValues,
  (newInputs, oldInputs) => {
    // iterate inputs, find bbox entries where crs changed
    for (const [key, val] of Object.entries(newInputs)) {
      const old = oldInputs ? (oldInputs as any)[key] : undefined
      if (val && typeof val === 'object' && 'bbox' in val && 'crs' in val) {
        const newCrs = val.crs
        const oldCrs = old && typeof old === 'object' ? old.crs : undefined
        if (oldCrs && newCrs && oldCrs !== newCrs) {
          // call reprojection (fire-and-forget)
          reprojectBbox(key, oldCrs, newCrs)
        }
      }
    }
  },
  { deep: true }
)

// Reproject displayed rectangle when user changes CRS while editing
watch(
  () => editingBboxKey.value ? inputValues.value[editingBboxKey.value]?.crs : null,
  async (newCrs, oldCrs) => {
    if (!map || !drawnFeature || !editingBboxKey.value) return;
    if (!newCrs || newCrs === oldCrs) return;

    // We want to keep displayed rectangle in EPSG:4326 for Leaflet,
    // so convert the stored bbox (in newCrs) -> 4326 for display
    try {
      await ensureProj4();
      let t = newCrs.toString();
      if (/^\d+$/.test(t)) t = `EPSG:${t}`;
      if (!/^EPSG:/i.test(t)) t = `EPSG:${t}`;

      const input = inputValues.value[editingBboxKey.value];
      if (!input || !Array.isArray(input.bbox) || input.bbox.length < 4) return;

      // If stored CRS is not 4326, convert to 4326 for display
      if (t !== 'EPSG:4326') {
        const sw = proj4(t, 'EPSG:4326', [input.bbox[0], input.bbox[1]]);
        const ne = proj4(t, 'EPSG:4326', [input.bbox[2], input.bbox[3]]);
        const displayBbox = [
          Math.min(sw[0], ne[0]),
          Math.min(sw[1], ne[1]),
          Math.max(sw[0], ne[0]),
          Math.max(sw[1], ne[1])
        ].map(Number);
        drawBboxOnMap(displayBbox);
      } else {
        drawBboxOnMap(input.bbox.map(Number));
      }
    } catch (e) {
      console.warn('Could not update displayed bbox after CRS change', e);
    }
  }
);
 
 
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
        <q-card-section class="q-pa-md bg-grey-1 rounded-borders q-mt-md">

          <!-- Version -->
          <div class="row q-mb-sm">
            <div class="col-3 text-grey-7 text-weight-bold">Software Version</div>
            <div class="col">
              {{ data.version || '—' }}
            </div>
          </div>

          <!-- Keywords -->
          <div class="row q-mb-sm">
            <div class="col-3 text-grey-7 text-weight-bold">Keywords</div>
            <div class="col">
              <span v-if="data.keywords?.length">
                {{ data.keywords.join(', ') }}
              </span>
              <span v-else>—</span>
            </div>
          </div>

              <!-- Metadata -->
                <div class="row q-mb-sm">
                  <div class="col-12 text-weight-bold q-mb-xs">Additional Metadata</div>

                  <div v-if="data.metadata?.length" class="col-12">

                    <div
                      v-for="(md, index) in data.metadata"
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

                  <div v-else class="col-12">
                  —
                  </div>
                </div>

        </q-card-section>
        <q-separator class="q-mt-md" />
      </div>
 
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
 
            <div class="q-gutter-sm">
              <q-badge color="grey-3" text-color="black" class="q-mb-sm">
                {{ typeLabel(input, inputValues[inputId]) }}
              </q-badge>
 
              <!-- Complex Input (Multiple or Single) -->
              <template v-if="isComplexInput(input)">
                <template v-if="Array.isArray(inputValues[inputId])">
                  <div
                    v-for="(item, idx) in inputValues[inputId]"
                    :key="idx"
                    class="q-gutter-sm q-mb-md"
                  >
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
                        :error="validationErrors[inputId]"
                        :error-message="validationErrors[inputId] ? 'This field is required' : ''"
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
                        :error="validationErrors[inputId]"
                        :error-message="validationErrors[inputId] ? 'This field is required' : ''"
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
                      :error="validationErrors[inputId]"
                      :error-message="validationErrors[inputId] ? 'This field is required' : ''"
                    />
                  </div>
                </template>
              </template>
 
              <!--  Bounding Box Input with Leaflet Popup -->
              <template v-else-if="isBoundingBoxInput(input)">
                <div class="bbox-input q-pa-sm bg-grey-1 rounded-borders">
                  <div class="text-subtitle1 text-weight-medium q-mb-xs">
                    {{ inputId }} (Bounding Box)
                  </div>
 
                  <!-- Show current bbox -->
                  <div class="q-mb-sm">
                    <q-badge color="blue-2" text-color="black" label="BBox:" />
                    <span class="q-ml-sm text-grey-8">{{ inputValues[inputId].bbox }}</span>
                    <q-btn flat dense icon="edit" @click="openBboxPopup(inputId)">
                      <q-tooltip>Edit Bounding Box on Map</q-tooltip>
                    </q-btn>
                  </div>
 
                  <!-- CRS selector -->
                  <q-select
                    v-model="inputValues[inputId].crs"
                    :options="['EPSG:4326', 'EPSG:3857', 'EPSG:32611']"
                    label="CRS / EPSG"
                    filled
                    dense
                    emit-value
                    map-options
                  />
 
                  <!-- Optional: numeric bbox edit fields -->
                  <div class="row q-gutter-sm q-mt-sm">
                    <q-input
                      v-for="(coord, idx) in inputValues[inputId].bbox"
                      :key="idx"
                      v-model.number="inputValues[inputId].bbox[idx]"
                      :label="['minX','minY','maxX','maxY'][idx]"
                      type="number"
                      filled
                      dense
                      style="flex: 1"
                    />
                  </div>
                </div>
              </template>
 
              <!-- Multiple Value Input -->
              <template v-else-if="Array.isArray(inputValues[inputId])">
                <div
                  v-for="(val, idx) in inputValues[inputId]"
                  :key="idx"
                  class="row items-center q-gutter-sm q-mb-sm"
                >
                  <q-input
                    filled
                    v-model="inputValues[inputId][idx]"
                    :type="input.schema?.type === 'number' ? 'number' : 'text'"
                    :label="`${input.title || inputId} ${idx + 1}`"
                    dense
                    style="flex: 1"
                    :error="validationErrors[inputId]"
                    :error-message="validationErrors[inputId] ? 'This field is required' : ''"
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
 
              <!-- Literal Input -->
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
 
              <!-- Enum Input -->
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
 
        <!-- Map Dialog (Only one global instance outside v-for) -->
        <q-dialog v-model="bboxDialogVisible" persistent>
          <q-card style="width: 90vw; max-width: 1000px; height: 80vh;">
            <!-- Header Section -->
            <q-bar class="bg-primary text-white">
              <q-icon name="map" size="sm" class="q-mr-sm" />
              <div class="text-h6">Bounding Box Map</div>
              <q-space />
              <q-btn dense flat icon="close" v-close-popup />
            </q-bar>
 
            <!-- Map Section -->
            <q-card-section class="q-pa-none" style="height: calc(100% - 100px);">
              <div id="bbox-map" style="width:100%; height:100%;"></div>
            </q-card-section>
 
            <!-- Action Buttons -->
            <q-card-actions align="right" class="bg-grey-2">
              <q-btn flat label="Cancel" color="negative" @click="closeBboxPopup" />
              <q-btn color="primary" glossy label="Confirm Bounding Box" @click="confirmBboxSelection" />
            </q-card-actions>
          </q-card>
        </q-dialog>
 
 
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
          <q-btn label="Submit" type="submit" color="primary"  
          :loading="loading || submitting"
          :disable="loading || submitting" />
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
              :loading="loading || submitting"
              :disable="loading || submitting"
              @click="() => { showDialog = false; submitProcess() }"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
 
      <div v-if="submitting" class="text-caption text-primary q-mt-sm">
        Submitting...
      </div>
 
      <div class="q-mt-md" v-if="loading">
        <q-linear-progress
          :value="progressPercent / 100"
          color="primary"
          size="lg"
          rounded
        />
 
     
        <div class="row items-center justify-between q-mt-xs">
          <div class="text-caption text-primary">
            <span v-if="progressMessage">{{ progressMessage }}</span>
            <span v-else>Status: {{ jobStatus }}</span>
          </div>
 
         
          <div class="text-caption text-primary text-bold">
            {{ progressPercent }}%
          </div>
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
 