export default defineNuxtPlugin(async (nuxtApp) => {
    const headers = useRequestHeaders(['cookie']);
    const { status, data } = useAuth();
    const authStore = useAuthStore();

    try {
        if (status.value === 'authenticated') {
            authStore.isAuthenticated = true;

            const { data: token, error } = await useFetch('/api/token', { headers });

            if (token.value) {
                authStore.setToken(token.value);
                authStore.setUser(data.value.user);
            } else if (error.value) {
                // Session invalide ou détruite, on ignore silencieusement
                authStore.clearAuth();
            }
        }
    } catch (error) {
        // Ignore les erreurs de session après logout
        console.debug('Auth plugin: session unavailable', error);
        authStore.clearAuth();
    }
});
