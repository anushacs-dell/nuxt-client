<template>
  <q-header bordered>
    <q-toolbar class="bg-white text-grey-10 justify-between">
      <div class="col-auto">
        <div class="row">

          <div class="col-auto">
            <NuxtLink to="/">
              <q-avatar square >
                <q-img src="https://zoo-project.org/images/zoo-sun-logo-big.png" width="128"/>
              </q-avatar>

            </NuxtLink>
          </div>
          <div class="col-auto q-pl-xs q-pt-xs" v-show="!isSmallScreen">
            <span class="q-pl-xs text-h6 ">
              <NuxtLink to="/" class="text-grey-10" style="text-decoration: none;">
                Zoo-Project
              </NuxtLink>
            </span>
          </div>
        </div>
      </div>
      <div :class="['q-px-sm', isSmallScreen ? '' : 'col-5'] ">

      </div>
      <div class="col-auto">
         <div class="row items-center"> 
          <SettingsMenu />

          <div class="q-pt-sm" style="padding-top: 36px;">
            <LayoutSharedHeaderMenu :show="showHeaderMenu" @hide="showHeaderMenu = false"/>
          </div>
          <div v-if="!authStore.user">
            <q-btn v-if="isSmallScreen" class="q-px-sm" dense no-caps color="accent" round
                   icon="mdi-account-circle" href="/api/auth/signin"/>
            <q-btn v-else-if="!isLoggedUser" class="q-px-md" no-caps color="accent" :label="t('Authenticate')"
                   :href="'/api/auth/signin'"/>
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
                  :href="`${config.public.NUXT_OIDC_ISSUER}/account/?referrer=${config.public.NUXT_OIDC_CLIENT_ID}&referrer_uri=${config.public.AUTH_ORIGIN}`"
                  class="q-px-lg">
                  <q-item-section class="q-px-sm">{{ t('Profile') }}</q-item-section>
                </q-item>
                <q-separator/>
                <q-item clickable v-close-popup @click="showLogoutDialog">
                  <q-item-section class="q-px-sm">{{ t('logout') }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </div>
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

const config = useRuntimeConfig()
const showHeaderMenu = ref(false)
const isLoggedUser = ref(false) // TODO: Implement user authentication and pinia storage of user data
const loggedUser = ref({email: 'mathereall@gmail.com'}) // TODO: Implement user authentication and pinia storage of user data


const authStore = useAuthStore()
const { landingLinks } = useLandingLinks()




const { locale, t } = useI18n()


const $q = useQuasar()
const stringToMD5 = useStringToMD5()

const isProcessing = ref(false)
const router = useRouter()
const {signOut} = useAuth()

const gravatarUrl = ref('https://www.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56/')




const selfHref = computed(() => {
  const selfLink = landingLinks.value.find(link => link.rel === 'self')
  return selfLink?.href || ''
})


function rewriteHref(href: string): string {
  if (!selfHref.value) return href
  let relative = href.replace(selfHref.value, '') 


  if (relative === 'api') relative = 'swagger'

  return `/${relative}` 
}

// helper to generate labels
function autoLabel(href: string, rel?: string): string {
  if (rel === 'service-desc') return 'Swagger'
  const filename = href.split('/').pop()?.replace('.html', '') || ''
  return filename.charAt(0).toUpperCase() + filename.slice(1)
}



const homeTab = computed(() =>
  landingLinks.value
    .filter(link => link.href && link.href.endsWith('index.html'))
    .map(link => ({
      path: '/', // always root for Home
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


const isSmallScreen = computed(() => {
  return $q.screen.width <= $q.screen.sizes.sm
})

const showLogoutDialog = () => {
  $q.dialog({
   title: t('logout'),
    message: t('Are you sure you want to logout?'),
    ok: {
      label: t('ok'),
      color: 'primary'
    },
    cancel: {
      label: t('cancel'),
      color: 'negative'
    }
  }).onOk(() => {
    handleLogout()
  })
}

const handleLogout = async () => {
  isProcessing.value = true
  try {
    await signOut({
      redirect: false,
    }).then(async (response) => {
      console.log("response: ", response)

      const token = authStore.token;
      const logoutUrl = `${config.public.NUXT_OIDC_ISSUER}/protocol/openid-connect/logout`;

      authStore.clearAuth()

      const body = new URLSearchParams({
          'id_token_hint': token.id_token,
          'post_logout_redirect_uri': config.public.AUTH_ORIGIN,
          'client_id': config.public.CLIENT_ID,
        });
      console.log("logoutUrl: ", logoutUrl)
      console.log("body: ", body)
      await fetch(`${logoutUrl}?${body.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }).then((response) => {
        console.log("keycloak logout response: ", response);
      });

      // authStore.clearAuth()
      // await router.push({path: '/'})
    }).finally(() => {
      isProcessing.value = false
      router.push({path: '/'})
    })
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  if (authStore.user && authStore.user.email) {
    gravatarUrl.value = `https://www.gravatar.com/avatar/${stringToMD5(authStore.user.email)}/`
  }
  console.log("process.env", process.env)
})

</script>

<style scoped>
</style>