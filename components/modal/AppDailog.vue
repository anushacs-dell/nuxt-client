<template>
  <q-dialog
    :model-value="modelValue"
    persistent
    @update:model-value="val => emit('update:modelValue', val)"
  >
    <q-card class="app-dialog">

      <!-- Fixed header -->
      <q-card-section class="row items-center dialog-header">
        <div class="text-h6">{{ title }}</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          @click="emit('update:modelValue', false)"
        />
      </q-card-section>

      <q-separator />

      <!-- Scrollable body -->
      <q-card-section class="dialog-body">
        <slot />
      </q-card-section>

      <!-- Footer (optional, fixed) -->
      <q-separator v-if="$slots.footer" />
      <q-card-section v-if="$slots.footer">
        <slot name="footer" />
      </q-card-section>

    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<style scoped>
.app-dialog {
  min-width: 400px;
  max-width: 80vw;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.dialog-body {
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

</style>
