<template>
  <component :is="layoutComponent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '~/stores/layout'
import { useI18n } from 'vue-i18n'
import { useCookie } from '#app'
import 'leaflet/dist/leaflet.css'
import 'leaflet.pm/dist/leaflet.pm.css'

import DefaultLayout from '~/layouts/Default.vue'
import QuasarLayout from '~/layouts/quasar.vue'

const layoutStore = useLayoutStore()

const layoutComponent = computed(() => {
  const map: Record<string, any> = {
    Default: DefaultLayout,
    quasar: QuasarLayout,
  }
  return map[layoutStore.currentLayout] || DefaultLayout
})


const { locale } = useI18n()
const langCookie = useCookie('i18n_redirected')

if (langCookie.value && langCookie.value !== locale.value) {
  locale.value = langCookie.value 
}
</script>


<style>
.q-card,
.q-btn,
.q-btn-dropdown,
.q-dialog__inner,
.q-item,
.q-table{
  border-radius: 12px !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06); 
}
.q-input{
  border-radius: 12px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.q-menu {
  border-radius: 12px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); 
}

.q-page {
  background: #f9f9f9; 
}

.hoverable-link {
  transition: background-color 0.3s ease;
  border-radius: 8px;
  padding: 6px 12px;
}

.hoverable-link:hover {
  background-color: #f5f5f5; /* soft hover effect */
}

.map {
  border: 1px solid #ccc;
  margin-top: 20px;
}
</style>