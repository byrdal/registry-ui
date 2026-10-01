<script setup>
import { useTheme } from '~/composables/useTheme';

const config = useRuntimeConfig();
const { isDark } = useTheme();
const { data: sync } = await useFetch('/api/sync');

const lastSync = computed(() => {
  if (!sync.value?.lastSyncAt) return 'Never';
  return new Date(sync.value.lastSyncAt).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
});

useHead(() => ({
  htmlAttrs: {
    class: isDark.value ? 'dark' : undefined,
  },
}));

// Set the page title dynamically from runtime config
useHead({
  title: config.public.registryTitle
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
    <header class="bg-white border-b border-gray-200 p-4 flex items-center gap-2 dark:bg-gray-800 dark:border-gray-700">
      <img class="h-12" src="/logo.png" alt="logo" />
      <span class="font-bold text-lg">{{ config.public.registryTitle }}</span>
      <ThemeToggle />
    </header>

    <slot />

    <footer class="bg-white border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
      Last registry sync: {{ lastSync }}
    </footer>
  </div>
</template>
