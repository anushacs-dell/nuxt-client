<template>
  <q-layout view="hHh LpR fFf">
    <LayoutDefaultHeader/>
    <q-page-container>
      <NuxtPage />
    </q-page-container>
    <LayoutDefaultFooter/>
  </q-layout>
</template>

<script setup lang="ts">
import LayoutDefaultHeader from '~/components/layout/default/Header.vue'
import LayoutDefaultFooter from '~/components/layout/default/Footer.vue'
</script>

<style scoped>

</style>