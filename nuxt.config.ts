// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

const registryUrl = process.env.REGISTRY_URL || "http://registry:5000";
const registryTitle = process.env.REGISTRY_TITLE || "Registry UI";
const registryPublicUrl = process.env.REGISTRY_PUBLIC_URL || "localhost:5000";
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
        // server-only
        registryUrl: registryUrl,
        registryUsername: process.env.REGISTRY_USERNAME || "",
        registryPassword: process.env.REGISTRY_PASSWORD || "",
        dbPath: process.env.DB_PATH || "/data/registry.db",
        public: {
            registryTitle: registryTitle,
            registryPublicUrl: registryPublicUrl
        }
    },
    app: {
        head: {
            title: registryTitle
        }
    }
});
