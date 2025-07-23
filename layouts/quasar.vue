<template>
  <q-layout view="hHh lpR fFf">
    <LayoutQuasarHeader
      @toggle-left="toggleLeftDrawer"
      @toggle-right="toggleRightDrawer"
    />

    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered />
    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" bordered />

    <q-page-container>
      <NuxtPage />
    </q-page-container>

    <LayoutQuasarFooter />
  </q-layout>
</template>

<script setup lang="ts">
import { ref } from 'vue'


const leftDrawerOpen = ref(false)
const rightDrawerOpen = ref(false)

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value
}


import LayoutQuasarHeader from '~/components/layout/quasar/Header.vue'
import LayoutQuasarFooter from '~/components/layout/quasar/Footer.vue'
</script>
