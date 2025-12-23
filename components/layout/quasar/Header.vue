<template>
  <q-header elevated class="bg-primary text-white" height-hint="98">
    <q-toolbar class="justify-between">
      
      <div class="row items-center">
        <NuxtLink to="/">
          <q-avatar square>
            <q-img src="https://zoo-project.org/images/zoo-sun-logo-big.png" width="128"/>
          </q-avatar>
        </NuxtLink>
        <span class="q-pl-sm text-h6">
          <NuxtLink to="/" class="text-white" style="text-decoration:none;">
            {{ appTitle }}
          </NuxtLink>
        </span>
      </div>

      
      <div class="row items-center">
        <SettingsMenu />

        <div v-if="!authStore.user">
          <q-btn class="q-ml-sm" dense no-caps color="accent"
                 :label="t('Authenticate')" :href="`${authBase}/api/auth/signin`"/>
        </div>
        <div v-else>
          <q-btn rounded dense flat>
            <q-avatar>
              <img :src="gravatarUrl">
            </q-avatar>
          </q-btn>
          <q-menu>
            <q-list dense>
              <q-item clickable v-close-popup 
                :href="`${config.public.NUXT_OIDC_ISSUER}/account/?referrer=${config.public.NUXT_OIDC_CLIENT_ID}&referrer_uri=${config.public.AUTH_ORIGIN}`">
                <q-item-section>{{ t('Profile') }}</q-item-section>
              </q-item>
              <q-separator/>
              <q-item clickable v-close-popup @click="showLogoutDialog">
                <q-item-section>{{ t('Logout') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
      </div>
    </q-toolbar>
<div class="row">
  <div class="col-auto">
    <q-tabs dense align="left">
      <q-route-tab
        v-for="tab in homeTab"
        :key="tab.path"
        :href="tab.path"
        :label="t(tab.label)"
        no-caps
      />
    </q-tabs>
  </div>
  <q-space/>
  <div class="col-auto">
    <q-tabs dense align="right">
      <q-route-tab
        v-for="tab in rightTabs"
        :key="tab.path"
        :label="t(tab.label)"
        :href="tab.path"
        no-caps
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
import { useLandingLinks } from '~/composables/utils/useLandingLinks'

import { useCustomAppConfig } from '~/composables/utils/useCustomAppConfig'

const { locale, t } = useI18n()

const authStore = useAuthStore()
const { appTitle } = useCustomAppConfig()
const config = useRuntimeConfig()

const showHeaderMenu = ref(false)
const isLoggedUser = ref(false) // TODO: Implement user authentication and pinia storage of user data
const loggedUser = ref({email: 'mathereall@gmail.com'}) // TODO: Implement user authentication and pinia storage of user data


const $q = useQuasar()
const stringToMD5 = useStringToMD5()
const router = useRouter()
const {signOut} = useAuth()

const { landingLinks } = useLandingLinks()
// Get baseURL from app config
const { $config } = useNuxtApp()
const baseURL = $config.app.baseURL || '/'
const authBase = (config.public.AUTH_ORIGIN || '').replace(/\/$/, '') || ''

const selfHref = computed(() => {
  const selfLink = landingLinks.value.find(link => link.rel === 'self')
  return selfLink?.href || ''
})


function rewriteHref(href: string): string {
  if (!selfHref.value) return href
  let relative = href.replace(selfHref.value, '') 


  if (relative === 'api') relative = 'swagger'

  // Add baseURL prefix
  return baseURL === '/' ? `/${relative}` : `${baseURL}/${relative}` 
}

// to generate labels
function autoLabel(href: string, rel?: string): string {
  if (rel === 'service-desc') return 'Swagger'
  const filename = href.split('/').pop()?.replace('.html', '') || ''
  return filename.charAt(0).toUpperCase() + filename.slice(1)
}



const homeTab = computed(() =>
  landingLinks.value
    .filter(link => link.href && link.href.endsWith('index.html'))
    .map(link => ({
      path: baseURL === '/' ? '/' : baseURL, // use baseURL for Home
      label: 'Home'
    }))
)

const rightTabs = computed(() =>
  landingLinks.value
    .filter(link =>
      link.href &&
      !link.href.endsWith('index.html') &&
      !link.href.endsWith('/') && 
      !link.href.includes('index') && 
      (
        link.type === 'application/json' ||
        link.rel === 'service-desc'
      )
    )
    .map(link => ({
      path: rewriteHref(link.href),
      label: autoLabel(link.href, link.rel)
    }))
)


const gravatarUrl = ref('https://www.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56/')

const isSmallScreen = computed(() => {
  return $q.screen.width <= $q.screen.sizes.sm
})

const isProcessing = ref(false)

const showLogoutDialog = () => {
  $q.dialog({
   title: t('Logout'),
    message: t('Are you sure you want to logout?'),
    ok: {
      label: t('Ok'),
      color: 'primary'
    },
    cancel: {
      label: t('Cancel'),
      color: 'negative'
    }
  }).onOk(() => {
    handleLogout()
  })
}

const handleLogout = async () => {
  isProcessing.value = true
  try {
    const callbackUrl = process.client
      ? window.location.origin
      : (authBase || baseURL || '/')

    // 1) Invalidate NextAuth session + cookies (same origin)
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ callbackUrl }),
        credentials: 'include',
      })
    } catch (e) {
      console.warn('signout fetch failed', e)
    }
    await signOut({ redirect: false, callbackUrl })

    // 2) End Keycloak session via redirect (complete SSO logout)
    const token = authStore.token
    authStore.clearAuth()
    
    if (process.client && token?.id_token) {
      const logoutUrl = `${config.public.NUXT_OIDC_ISSUER}/protocol/openid-connect/logout`
      const params = new URLSearchParams({
        id_token_hint: token.id_token,
        post_logout_redirect_uri: callbackUrl,
        client_id: config.public.NUXT_OIDC_CLIENT_ID,
      })
      // Redirect to Keycloak for complete SSO logout
      window.location.href = `${logoutUrl}?${params.toString()}`
    } else if (process.client) {
      // Fallback: simple reload if no token
      window.location.href = callbackUrl
    }
  } catch (error) {
    console.error(error)
  } finally {
    isProcessing.value = false
  }
}

onMounted(() => {
  if (authStore.user && authStore.user.email) {
    gravatarUrl.value = `https://www.gravatar.com/avatar/${stringToMD5(authStore.user.email)}/`
  }
  console.log("process.env", process.env)
})

</script>
