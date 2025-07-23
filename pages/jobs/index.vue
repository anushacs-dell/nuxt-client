<template>
  <q-page class="q-pa-sm">
    <div class="row justify-center">
      <div class="col-12 q-pa-lg" style="max-width: 1080px;">
        <p class="text-h4 q-mb-md text-weight-bold">{{ t('Jobs List') }}</p>
        <q-separator />

        <q-card class="q-pa-md q-mt-md shadow-2 rounded-borders">
          <q-table
            :title="t('Jobs List')"
            :rows="rows"
            :columns="columns"
            row-key="jobID"
            :loading="loading"
            :separator="'horizontal'" 
            flat
            bordered
            class="rounded-borders"
          >
            <template v-slot:body-cell-actions="props">
              <q-td :props="props" class="text-center">
                <q-btn-dropdown color="primary" label="Actions" flat rounded>
                  <q-list>
                    <q-item
                      v-for="(link, index) in getJobLinkOptions(props.row)"
                      :key="index"
                      clickable
                      v-close-popup
                      @click="fetchLinkContent(link.value)"
                    >
                      <q-item-section>{{ link.label }}</q-item-section>
                    </q-item>

                    <q-item clickable v-close-popup @click="viewJob(props.row)">
                      <q-item-section>{{ t('View') }}</q-item-section>
                    </q-item>
                    <q-item clickable v-close-popup @click="deleteJob(props.row)">
                      <q-item-section class="text-negative">{{ t('Delete') }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </q-td>
            </template>
          </q-table>
        </q-card>

        <q-dialog v-model="showModal" persistent>
          <q-card style="min-width: 600px; max-width: 90vw;" class="rounded-borders">
            <q-card-section class="row items-center q-pb-none">
              <div class="text-h6">{{ t('Link Content') }}</div>
              <q-space />
              <q-btn icon="close" flat round dense @click="showModal = false" />
            </q-card-section>

            <q-card-section>
              <div v-if="modalContent">
                <pre>{{ modalContent }}</pre>
              </div>
              <div v-else class="text-negative">{{ t('No data or failed to fetch') }}</div>
            </q-card-section>
          </q-card>
        </q-dialog>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRuntimeConfig } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useI18n } from 'vue-i18n'
import { Notify } from 'quasar'


const config = useRuntimeConfig()
const authStore = useAuthStore()
const router = useRouter()

const { locale, t } = useI18n()




const data = ref<any>(null)
const loading = ref(false)
const showModal = ref(false)
const modalContent = ref('')



const fetchData = async () => {
  loading.value = true
  try {
    const response = await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/jobs`, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    data.value = response
  } catch (error) {
    console.error('Error fetching jobs:', error)
    Notify.create({
      message: t('Failed to fetch jobs list'),
      color: 'negative',
      icon: 'error'
    })
  } finally {
    loading.value = false
  }
}



const fetchLinkContent = async (href: string) => {
  try {
    const res = await $fetch(href, {
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    modalContent.value = typeof res === 'object' ? JSON.stringify(res, null, 2) : res
    showModal.value = true
  } catch (err) {
    modalContent.value = 'Failed to fetch link content'
    showModal.value = true
    console.error(err)
  }
}


const deleteJob = async (row: any) => {
  try {
    await $fetch(`${config.public.NUXT_ZOO_BASEURL}/ogc-api/jobs/${row.jobID}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authStore.token.access_token}`,
        'Accept-Language': locale.value
      }
    })
    Notify.create({
      message: t('Job deleted successfully'),
      color: 'positive',
      icon: 'check'
    })
    await fetchData()
  } catch (error) {
    console.error('Error deleting job:', error)
    Notify.create({
      message: t('Failed to delete job'),
      color: 'negative',
      icon: 'error'
    })
  }
}


const viewJob = (row: any) => {
  router.push(`/jobs/${row.jobID}`)
}


const getJobLinkOptions = (job: any) => {
  if (!job?.links) return []
  return job.links.map((link: any, index: number) => ({
    label: link.title || link.rel || `Link ${index + 1}`,
    value: link.href
  }))
}


onMounted(() => {
  fetchData()
})


const rows = computed(() => {
  return data.value?.jobs || []
})


const columns = computed(() => [
  { name: 'jobID', label: t('Job ID'), field: 'jobID', align: 'left', sortable: true },
  { name: 'processID', label: t('Process'), field: 'processID', align: 'left' },
  { name: 'status', label: t('Status'), field: 'status', align: 'left' },
  { name: 'created', label: t('Created'), field: 'created', align: 'left' },
  { name: 'actions', label: t('Actions'), field: 'actions', align: 'center' }
])

</script>
