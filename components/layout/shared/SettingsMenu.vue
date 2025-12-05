<template>
    <q-btn flat round dense icon="settings">
      <q-menu>
        <q-list style="min-width: 200px">
          <q-item>
            <q-item-section>
              <q-select
                v-model="selectedLang"
                :options="options"
                dense borderless emit-value map-options
                :label="t('Language')"
              />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              <q-select
                v-model="selectedLayout"
                :options="[
                  { label: 'Default', value: 'Default' },
                  { label: 'Quasar', value: 'quasar' }
                ]"
                dense borderless emit-value map-options
                label="Layout"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useLayoutStore } from '~/stores/layout'
import { useI18n } from 'vue-i18n'
import { useCookie } from '#app'


const options = [
  { label: 'English', value: 'en-US' },
  { label: 'Française', value: 'fr-FR' }
]

const { locale, t } = useI18n()
const langCookie = useCookie('i18n_redirected')


const selectedLang = ref(langCookie.value || 'en-US')

// Sync changes
watch(selectedLang, (val) => {
  langCookie.value = val
  locale.value = val 
  console.log("Cookie + Header:", val)
  window.location.reload()
})




const layoutStore = useLayoutStore()
const selectedLayout = ref(layoutStore.currentLayout)
watch(selectedLayout, (val) => {
  layoutStore.setLayout(val)
})

const authStore = useAuthStore()
</script>
