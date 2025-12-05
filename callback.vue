<template>
  <div>
    <!-- Mensaje para el usuario mientras se maneja el callback -->
    <p>Authentication starting...</p>
  </div>
</template>

<script setup>
import { useAuth } from '@sidebase/nuxt-auth';

const { handleCallback } = useAuth();

// Maneja el callback
handleCallback().then(() => {
  alert('Autenticación exist');
  window.location.href = '/';
}).catch(error => {
  console.error('Error on callback:', error);
});
</script>
