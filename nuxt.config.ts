// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
    compatibilityDate: '2026-01-30',
    ssr: true,
    nitro: {
        preset: "node-server"
    },
    vite: {
        plugins: [
            tailwindcss(),
        ],
    },
    runtimeConfig: {
        // Server-only - will be overridden by NUXT_REGISTRY_URL, NUXT_REGISTRY_USERNAME, etc.
        registryUrl: "http://registry:5000",
        registryUsername: "",
        registryPassword: "",
        dbPath: "/data/registry.db",
        // Public - available to client-side code
        // Will be overridden by NUXT_PUBLIC_REGISTRY_TITLE and NUXT_PUBLIC_REGISTRY_PUBLIC_URL
        public: {
            registryTitle: "Registry UI",
            registryPublicUrl: "localhost:5000"
        }
    },
    app: {
        head: {
            title: "Registry UI",  // Static default; use registryTitle in layouts for dynamic title
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
                { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
                { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
                { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
                { rel: 'manifest', href: '/site.webmanifest' }
            ],
        }
    }
});
