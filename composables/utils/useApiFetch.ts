import { useCookie } from '#app'

export function useApiFetch<T>(url: string, options: any = {}) {
  const langCookie = useCookie('i18n_redirected')
  const fullCode = langCookie.value || 'en-US'

  return $fetch<T>(url, {
    ...options,
    headers: {
      ...options.headers,
      'Accept-Language': fullCode,
    },
  })
}
