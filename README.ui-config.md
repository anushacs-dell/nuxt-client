# Nuxt + Vue + Quasar: Layout & Language Switching Guide

Demonstrates how to switch between `Default` and `Quasar` layouts using Pinia and cookies, as well as language switching between English and French using `vue-i18n` and cookies.

---

## Features

- **Layout Switching**: Dynamic layout switching using a dropdown menu.
- **Language Switching**: Toggle between English (`en`) and French (`fr`) using `vue-i18n`.
- **Cookie Persistence**: Saves layout and language preferences in cookies to persist user settings across sessions.

---

## Folder Structure

```
layouts/
  default.vue
  quasar.vue

components/
  layout/
    shared/
      SettingsMenu.vue
    default/
      Header.vue
      Footer.vue
    quasar/
      Header.vue
      Footer.vue
```

---

## Language Switching Setup

### 1. Language Files

Create language JSON files:

```
i18n/locales/en.json
i18n/locales/fr.json
```

### 2. Configure `nuxt.config.ts`

```ts
modules: ["@nuxtjs/i18n"],

i18n: {
  langDir: 'locales',
  locales: [
    { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
    { code: 'fr', iso: 'fr-FR', file: 'fr.json', name: 'Française' }
  ],
  defaultLocale: 'en',
  lazy: true,
  strategy: 'no_prefix',
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'i18n_redirected',
    fallbackLocale: 'en',
  }
}
```

### 3. Language Dropdown in Header

```vue
<q-select
  v-model="selectedLang"
  :options="[{ label: 'English', value: 'en' }, { label: 'Française', value: 'fr' }]"
  dense borderless emit-value map-options label="Language" />
```

### 4. Vue Logic for Language Switch (in `header.vue`)

```ts
import { useI18n } from 'vue-i18n'
import { useCookie } from '#app'

const { locale } = useI18n()
const selectedLang = ref(locale.value)

watch(selectedLang, (val) => {
  locale.value = val
  useCookie('i18n_redirected').value = val
})
```

### 5. App-wide Locale Sync (in `/app.vue`)

```ts
const { locale } = useI18n()
const langCookie = useCookie('i18n_redirected')
if (langCookie.value && langCookie.value !== locale.value) {
  locale.value = langCookie.value
}
```

---

## Layout Switching Setup

### Store (`/stores/layout.ts`)

```ts
import { defineStore } from 'pinia'
import { useCookie } from '#app'

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    currentLayout: useCookie('selected_layout').value || 'Default'
  }),
  actions: {
    setLayout(layout: string) {
      this.currentLayout = layout
      useCookie('selected_layout').value = layout
    }
  }
})
```

### Layout Logic (in `app.vue`)

```vue
<template>
  <component :is="layoutComponent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '~/stores/layout'

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
</script>
```

### Layout Switcher Dropdown Example (in `header.vue`)

```vue
<q-select
  v-model="selectedLayout"
  :options="[{ label: 'Default', value: 'Default' }, { label: 'Quasar', value: 'quasar' }]"
  dense borderless emit-value map-options
  label="Layout" />
```

### Logic for Layout Switching (in `header.vue`)

```ts
const layoutStore = useLayoutStore()
const selectedLayout = ref(layoutStore.currentLayout)

watch(selectedLayout, (newLayout) => {
  layoutStore.setLayout(newLayout)
})
```

## How Switching Works

- `selectedLayout` is saved in a cookie (`selected_layout`).
- The selected layout is used in `<app.vue>` using dynamic components.
- Headers and footers for each layout are created separately under `components/layout`.
- Language is stored in cookie `i18n_redirected`.

---

## Usage Tips

- Include layout and language switchers in both layouts (`Default`, `Quasar`).
- Use `<NuxtPage />` inside `<q-page-container>` in each layout.
- Layout and language are persisted with cookies: `selected_layout`, `i18n_redirected`.

---

