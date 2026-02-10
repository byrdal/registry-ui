<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <main class="flex-1 overflow-y-auto p-8">
      <header class="flex justify-between items-center mb-8">
        <h1 class="font-bold text-xl">Repositories</h1>
        <div class="relative w-96">
          <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
          <input
            v-model="q"
            type="text"
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder="Search images (e.g., node, nginx). .."
          />
        </div>
      </header>

      <div class="grid grid-cols-2 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-sm text-gray-500 mb-2">Total Images</div>
          <div class="text-3xl font-bold text-gray-900">{{ totalImages }}</div>
        </div>
        <div class="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div class="text-sm text-gray-500 mb-2">Storage Used</div>
          <div class="text-3xl font-bold text-gray-900">{{ formatBytes(totalStorage) }}</div>
        </div>
      </div>

      <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div class="p-4 border-b border-gray-200 bg-gray-50">
          <span class="text-sm font-bold text-gray-500">IMAGE</span>
        </div>

          <div class="p-6 border-b border-gray-200 flex justify-between items-start transition hover:bg-gray-50" v-for="r in filtered" :key="r.name">
              <div class="flex gap-4 items-start">
                <div class="bg-blue-50 text-sky-500 w-10 h-10 rounded-lg flex items-center justify-center font-bold">
                  {{ getRepoInitial(r.name) }}
                </div>
                <div>
                  <NuxtLink :to="`/repos/${r.slug}`" class="font-bold text-sky-600 hover:text-sky-800 transition">
                    {{ r.name }}
                  </NuxtLink>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-700" v-for="tag in r.tags.slice(0, 10)" :key="tag">{{ tag }}</span>
                  <span class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-700" v-if="r.tags.length > 10">...</span>
                </div>
              </div>
            </div>
          <div class="flex flex-col items-end gap-2">
            <div class="flex items-center bg-gray-100 border border-gray-300 rounded-lg p-2 gap-3 cursor-pointer hover:border-sky-500 transition" @click="copyToClipboard(`docker pull ${registryPublicUrl}/${r.name}:${r.tags[0]}`)">
              <span class="text-gray-700 text-xs font-mono">{{ `docker pull ${registryPublicUrl}/${r.name}:${r.tags[0]}` }}</span>
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            </div>
            <div class="flex gap-3 text-xs text-gray-500">
              <span>Updated {{ formatDate(r.last_tag_created_at) }}</span>
              <span>•</span>
              <span>{{ formatBytes(r.size_bytes) }}</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div id="toast" class="fixed hidden min-w-[250px] bg-gray-800 text-white text-center rounded-lg p-3 z-10 left-1/2 bottom-8 transform -translate-x-1/2 text-sm opacity-0 transition-all duration-300">Copied to clipboard!</div>
  </div>
</template>

<script setup>
const config = useRuntimeConfig();
const registryPublicUrl = config.public.registryPublicUrl;

const q = ref("");
const { data, pending, error } = await useFetch("/api/repos");

const totalImages = computed(() => {
  return data.value?.repos?.length || 0;
});

const totalStorage = computed(() => {
  const repos = data.value?.repos || [];
  return repos.reduce((sum, r) => sum + (r.size_bytes || 0), 0);
});

const filtered = computed(() => {
  const repos = data.value?.repos || [];
  const s = q.value.trim().toLowerCase();
  if (!s) return repos;
  return repos.filter((r) => r.name.toLowerCase().includes(s));
});

function getRepoInitial(name) {
  return name.substring(0, 2).toUpperCase();
}

function formatBytes(n) {
  if (n == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateString) {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    var toast = document.getElementById("toast");
    toast.className = "fixed show min-w-[250px] bg-gray-800 text-white text-center rounded-lg p-3 z-10 left-1/2 bottom-8 transform -translate-x-1/2 text-sm opacity-100 transition-all duration-300";
    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}
</script>

<style>
@import "tailwindcss";
</style>