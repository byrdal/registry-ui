<template>
  <div class="flex flex-col h-screen bg-gray-50">
    <main class="flex-1 overflow-y-auto p-8">
      <header class="flex justify-between items-center mb-8">
        <div>
          <NuxtLink to="/" class="flex items-center text-sky-600 hover:text-sky-800 transition">
            ← Back
          </NuxtLink>
          <h1 class="font-bold text-xl mt-2">{{ data?.repo }}</h1>
        </div>
        <div class="relative w-96">
          <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
          <input
            v-model="q"
            type="text"
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder="Search tags…"
          />
        </div>
      </header>

      <div v-if="pending" class="text-center py-8">Loading…</div>
      <div v-else-if="error" class="text-center py-8 text-red-500">Error: {{ error.message }}</div>

      <div v-else class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Digest</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="img in filtered" :key="img.digest || img.tags[0]" class="hover:bg-gray-50">
              <td class="px-6 py-4 text-sm font-medium text-gray-900">
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in img.tags" :key="tag" class="inline-block px-2 py-0.5 text-xs font-medium rounded bg-sky-100 text-sky-700">{{ tag }}</span>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <code class="text-xs">{{ img.digest || "-" }}</code>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ img.platform || "-" }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{{ formatBytes(img.size_bytes) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(img.created_at) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <button
                  v-if="img.digest"
                  @click="deleteImage(img)"
                  :disabled="deleting[img.digest]"
                  class="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition text-xs font-medium cursor-pointer"
                >
                  {{ deleting[img.digest] ? 'Deleting...' : 'Delete' }}
                </button>
                <span v-else class="text-gray-400 text-xs">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <div id="toast" class="fixed hidden min-w-[250px] bg-gray-800 text-white text-center rounded-lg p-3 z-10 left-1/2 bottom-8 transform -translate-x-1/2 text-sm opacity-0 transition-all duration-300"></div>
  </div>
</template>

<script setup>
const route = useRoute();

const q = ref("");
const deleting = ref({});
const { data, pending, error, refresh } = await useFetch(`/api/repos/${encodeURIComponent(route.params.slug)}/tags`);

const filtered = computed(() => {
  const images = data.value?.images || [];
  const s = q.value.trim().toLowerCase();
  if (!s) return images;
  return images.filter((img) => img.tags.some((t) => t.toLowerCase().includes(s)));
});

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
  if (!dateString) return "-";
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

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `fixed show min-w-[250px] ${isError ? 'bg-red-600' : 'bg-gray-800'} text-white text-center rounded-lg p-3 z-10 left-1/2 bottom-8 transform -translate-x-1/2 text-sm opacity-100 transition-all duration-300`;
  setTimeout(() => {
    toast.className = toast.className.replace("show", "");
  }, 3000);
}

async function deleteImage(img) {
  const tagList = img.tags.join(', ');
  const confirmed = confirm(
    `Are you sure you want to delete this image?\n\nTags: ${tagList}\nDigest: ${img.digest}\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  deleting.value[img.digest] = true;

  try {
    await $fetch(
      `/api/repos/${encodeURIComponent(route.params.slug)}/tags/${encodeURIComponent(img.digest)}`,
      { method: 'DELETE' }
    );

    // Refresh the data after successful deletion
    await refresh();

    showToast('Image deleted successfully');
  } catch (err) {
    console.error('Delete failed:', err);
    const errorMsg = err.data?.message || err.message || 'Unknown error';
    showToast(`Failed to delete: ${errorMsg}`, true);
  } finally {
    deleting.value[img.digest] = false;
  }
}
</script>
