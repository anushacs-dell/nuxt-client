// https://nuxt.com/docs/api/configuration/nuxt-config
import {defineQuasarConfig} from './quasar.config'

export default defineNuxtConfig({
    app: {
        head: {
            title: 'ZOO-Project Nuxt Client',
            meta: [
                {
                    name: 'description',
                    content: 'ZOO-Project WebApp Client Made with Nuxt3 and VueJS 3.'
                }
            ],
            link: [
                {rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Icons'}
            ]
        },
    },
    compatibilityDate: '2024-12-31',
    devtools: {enabled: true},
    components: true,
    imports: {
        dirs: [
            // Scan top-level modules
            'composables',
            // ... or scan all modules within given directory
            'composables/**',
        ]
    },
    quasar: defineQuasarConfig(),
    vue: {
        compilerOptions: {}
    },
    modules: ["@pinia/nuxt", "nuxt-quasar-ui", "@sidebase/nuxt-auth","@nuxtjs/i18n"],

    i18n: {
        langDir: 'locales',
        locales: [
          { code: 'en-US', iso: 'en-US', file: 'en.json', name: 'English' },
          { code: 'fr-FR', iso: 'fr-FR', file: 'fr.json', name: 'Française' }
        ],
        defaultLocale: 'en-US',
        lazy: true,
        strategy: 'no_prefix',
        detectBrowserLanguage: {
          useCookie: true,
          cookieKey: 'i18n_redirected',
          fallbackLocale: 'en-US',
        }
      },
       

    auth: {
        isEnabled: true,
        disableServerSideAuth: false,
        originEnvKey: 'AUTH_ORIGIN',

        provider: {
            type: 'authjs',
            trustHost: true,
        },
        sessionRefresh: {
            enablePeriodically: false,
            enableOnWindowFocus: true,
        },

    },
    runtimeConfig: {
        authSecret: process.env.NUXT_AUTH_SECRET,
        public: {
            quasarBrand: defineQuasarConfig().config.brand,
            NUXT_ZOO_BASEURL: process.env.NUXT_ZOO_BASEURL,
            NUXT_OIDC_ISSUER: process.env.NUXT_OIDC_ISSUER,
            NUXT_OIDC_CLIENT_ID: process.env.NUXT_OIDC_CLIENT_ID,
            AUTH_ORIGIN: process.env.AUTH_ORIGIN,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL,
            ZOO_OGCAPI_REQUIRES_BEARER_TOKEN: process.env.ZOO_OGCAPI_REQUIRES_BEARER_TOKEN,
            SUBSCRIBERURL: process.env.SUBSCRIBERURL,
        },
    }
})