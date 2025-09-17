<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    persistent
  >
    <q-card style="max-width: 700px; width: 90vw;">
      <q-card-section style="background-color: #663e05; color: white;">
        <div class="text-h6">{{ title }}</div>
      </q-card-section>
      <q-separator />
      <q-card-section class="q-pt-none">
        <!-- Used helpContent here -->
        <div v-html="helpContent"></div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title: { type: String, default: "Help" },
  helpContent: { type: String, default: "" }
})

const emit = defineEmits(["update:modelValue"])
</script>
