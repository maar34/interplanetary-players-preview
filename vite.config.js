import { defineConfig } from 'vite'
import restart from 'vite-plugin-restart'

export default defineConfig({
    base: '/interplanetary-players-preview/',   // repo name with leading & trailing slash
    root: '.', // Root directory where index.html is located
    publicDir: 'public', // Serve static assets from 'public' folder
    server: {
        host: true, 
        open: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
    },
    plugins: [
        restart({
            restart: ['public/**'],
        }),
    ],
})
