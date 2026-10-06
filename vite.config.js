import { defineConfig } from 'vite';

// `vite build --mode crazygames`: the release for CrazyGames (its SDK in the
// page, no dev kit, relative paths so it runs from any folder), built to
// dist-crazygames. Plain `vite` / `vite build`: the dev game, as always.
export default defineConfig(({ mode }) => {
  const cg = mode === 'crazygames';
  return {
    base: cg ? './' : '/',
    define: { __CG__: JSON.stringify(cg) },
    build: cg ? { outDir: 'dist-crazygames', emptyOutDir: true, chunkSizeWarningLimit: 4000 } : {},
    plugins: [
      cg && {
        name: 'crazygames-page',
        transformIndexHtml: {
          order: 'pre',
          handler: (html) =>
            html
              .replace('<title>', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>\n  <title>')
              .replace('/src/main.js', '/src/boot.js'),
        },
      },
    ].filter(Boolean),
  };
});
