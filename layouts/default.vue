<script setup>
const config = useRuntimeConfig();

// Set the page title dynamically from runtime config
useHead({
  title: config.public.registryTitle
});
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 p-4 flex items-center gap-2">
      <div class="w-8 h-8 bg-sky-500 rounded"></div>
      <span class="font-bold text-lg">{{ config.public.registryTitle }}</span>
    </header>

    <slot />
  </div>
</template>