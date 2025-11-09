import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.defines
  envPrefix: ['VITE_', 'TAURI_'],

  // Define global variables for browser compatibility with Node.js libraries
  define: {
    global: 'globalThis',
    'process.env': {},
  },

  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari15',
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,

    // Code splitting configuration for better bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'zustand'],
          'vendor-socket': ['socket.io-client'],
          'vendor-webrtc': ['simple-peer'],
          'vendor-ui': ['lucide-react'],
        },
      },
    },

    // Increase chunk size limit to avoid warnings during development
    // Target is still to reduce overall bundle size through splitting
    chunkSizeWarningLimit: 600,
  },

  // Optimize dependencies for faster dev server startup
  optimizeDeps: {
    include: ['react', 'react-dom', 'socket.io-client', 'simple-peer'],
  },
})
