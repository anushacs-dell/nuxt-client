<template>
  <q-header elevated class="bg-primary text-white" height-hint="98">
    <q-toolbar>
      <q-btn dense flat round icon="menu" @click="$emit('toggle-left')" />

      <q-toolbar-title>
        <q-avatar>
          <img src="https://cdn.quasar.dev/logo-v2/svg/logo-mono-white.svg">
        </q-avatar>
        Title
      </q-toolbar-title>

      <SettingsMenu />

      <q-btn dense flat round icon="menu" @click="$emit('toggle-right')" />
    </q-toolbar>

<div class="row">
  <div class="col-auto">
    <q-tabs dense align="left">
      <q-route-tab
        v-for="tab in leftTabs"
        :key="tab.path"
        no-caps
        :to="tab.path"
        :label="t(tab.label)"
      />
    </q-tabs>
  </div>
  <q-space/>
  <div class="col-auto">
    <q-tabs dense align="left">
      <q-route-tab
        v-for="tab in rightTabs"
        :key="tab.path"
        no-caps
        :to="tab.path"
        :label="t(tab.label)"
      />
    </q-tabs>
  </div>
</div>

  </q-header>
</template>

<script setup lang="ts">
import SettingsMenu from '~/components/layout/shared/SettingsMenu.vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCookie } from '#app'
import { useAuthStore } from '~/stores/auth'
import { menuItems } from '~/composables/utils/menuItems'

const { locale, t } = useI18n()

const authStore = useAuthStore()
const leftTabs = computed(() => {
  return menuItems.filter(item => !item.auth)
})

const rightTabs = computed(() => {
  return menuItems.filter(item => item.auth && authStore.user)
})

</script>
