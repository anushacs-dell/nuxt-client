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
        <div class="row">
          <div class="q-pt-sm" style="padding-top: 36px;">
            <LayoutSharedHeaderMenu :show="showHeaderMenu" @hide="showHeaderMenu = false"/>
          </div>
          <div v-if="!authStore.user">
            <q-btn v-if="isSmallScreen" class="q-px-sm" dense no-caps color="accent" round
                   icon="mdi-account-circle" href="/api/auth/signin"/>
            <q-btn v-else-if="!isLoggedUser" class="q-px-md" no-caps color="accent" label="Authenticate"
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
                  class="q-px-lg" >
                  <q-item-section class="q-px-sm">Profile</q-item-section>
                </q-item>
                <q-separator/>
                <q-item clickable v-close-popup @click="showLogoutDialog">
                  <q-item-section class="q-px-sm">Logout</q-item-section>
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
          <q-route-tab no-caps to="/" label="Home"/>
        </q-tabs>
      </div>
      <q-space/>
      <div class="col-auto">
        <q-tabs dense align="left">
          <q-route-tab v-if="authStore.user" no-caps to="/swagger" label="Swagger"/>
          <q-route-tab v-if="authStore.user" no-caps to="/processes" label="Processes"/>
          <q-route-tab v-if="authStore.user" no-caps to="/jobs" label="Jobs"/>
        </q-tabs>
      </div>
    </div>
  </q-header>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const showHeaderMenu = ref(false)
const isLoggedUser = ref(false) // TODO: Implement user authentication and pinia storage o
const loggedUser = ref({email: 'mathereall@gmail.com'}) // TODO: Implement user authentication and pinia storage of user data

const authStore = useAuthStore()
const $q = useQuasar()
const stringToMD5 = useStringToMD5()

const isProcessing = ref(false)
const router = useRouter()
const {signOut} = useAuth()

const gravatarUrl = ref('https://www.gravatar.com/avatar/46d229b033af06a191ff2267bca9ae56/')

const isSmallScreen = computed(() => {
  return $q.screen.width <= $q.screen.sizes.sm
})

const showLogoutDialog = () => {
  $q.dialog({
    title: 'Logout',
    message: 'Are you sure you want to logout?',
    ok: {
      label: 'Logout',
      color: 'primary',
    },
    cancel: {
      label: 'Cancel',
      color: 'negative',
    },
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
          'client_id': config.public.NUXT_OIDC_CLIENT_ID,
          'post_logout_redirect_uri': config.public.AUTH_ORIGIN,
          'id_token_hint': token.id_token,
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
  console.log("onMounted Header")
  console.log(loggedUser.value)
  console.log()
  console.log("/onMounted Header")
  if(authStore.user && authStore.user.email) {
    gravatarUrl.value = `https://www.gravatar.com/avatar/${stringToMD5(authStore.user.email)}/`
  }
})

</script>

<style scoped>

</style>
