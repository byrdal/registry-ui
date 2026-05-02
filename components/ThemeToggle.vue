<script setup lang="ts">
import { useTheme } from '~/composables/useTheme';

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <div class="ml-auto flex items-center gap-3">
    <span class="text-sm text-gray-600">Theme</span>
    <button
      type="button"
      :aria-pressed="isDark"
      :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
      class="relative inline-flex h-7 w-12 items-center rounded-full border border-gray-300 bg-gray-200 px-1 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
      :class="isDark ? 'bg-sky-500 border-sky-400' : 'bg-gray-200 border-gray-300'"
      @click="toggleTheme"
    >
      <span
        class="inline-block h-5 w-5 rounded-full bg-white shadow"
        :class="isDark ? 'translate-x-5' : 'translate-x-0'"
      />
    </button>
  </div>
</template>
