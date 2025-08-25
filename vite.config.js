import { resolve } from 'path'
import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
    test: {watch: false},
    build: {
        target: ['safari12', 'firefox101', 'chrome103', 'edge103', 'opera88'],
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            fileName: 'index',
            formats: ['es']
        },
        minify: 'esbuild',
        rollupOptions: {
            plugins: [
                visualizer({
                    filename: 'dist/stats.html',
                    open: false,
                    gzipSize: true,
                    brotliSize: true,
                })
            ]
        }
    },
})
