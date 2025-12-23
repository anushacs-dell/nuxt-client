<template>
  <div id="swagger-ui"/>
</template>

<script setup>
import { onMounted } from 'vue';
import SwaggerUI from 'swagger-ui';
import 'swagger-ui/dist/swagger-ui.css';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const config = useRuntimeConfig();
const serverUrl = config.public.NUXT_ZOO_BASEURL + '/ogc-api';

onMounted(() => {
  console.log("serverUrl", serverUrl);
  SwaggerUI({
    dom_id: '#swagger-ui',
    url: serverUrl + '/api',
    presets: [SwaggerUI.presets.apis],
    deepLinking: true,
    showExtensions: true,
    showCommonExtensions: true,
    requestInterceptor: (req) => {
      const paths = ['/api', '/me', '/jobs', '/processes', '/stac', '/raster'];
      // if (req.url.startsWith(serverUrl) && paths.some(path => req.url.includes('/ogc-api' + path))) {
      if (paths.some(path => req.url.includes('/ogc-api' + path))) {
        if (config.public.ZOO_OGCAPI_REQUIRES_BEARER_TOKEN === 'true') {
          const token = authStore.token?.access_token;
          if (!token) return;
          if (token) {
            req.headers.Authorization = `Bearer ${token}`;
          }
        }
      }
      return req;
    },
  });
});
</script>

<style scoped>
::v-deep .scheme-container {
  display: none !important;
}

::v-deep h2 small,
::v-deep h2 small .version {
  line-height: initial;
}

::v-deep h2 small .version-stamp {
  line-height: initial;
}
</style>
