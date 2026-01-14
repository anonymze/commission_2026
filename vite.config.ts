import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { cloudflare } from '@cloudflare/vite-plugin'
// import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig(({ mode }) => ({
  plugins: [
    devtools(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    // Only enable cloudflare plugin in build mode to avoid dev conflicts
    ...(mode === 'production' ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : []),
    // nitro(), // Commented: experimental, conflicts with TanStack Start manifest plugin
  ],
  // nitro: {
  //   preset: "vercel"
  // },
  optimizeDeps: {
    exclude: [
      "@tanstack/react-start",
      "@tanstack/start-server-core",
      "@tanstack/react-router",
    ],
  },
}));

export default config;
