import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig((opt) => {
  return {
    build: {
      minify: false,
      outDir: 'dist',
      rollupOptions: {
        input: {
          content: resolve(__dirname, 'src/content.ts'),
          background: resolve(__dirname, 'src/background.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
          chunkFileNames: '[name].[ext]'
        },
      },
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: "src/manifest.json",
            dest: ".",
          },
        ],
        watch: true,
      }),
    ],
  };
});
