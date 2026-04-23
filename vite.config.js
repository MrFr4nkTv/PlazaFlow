import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Root = raíz del proyecto. Así /src y /public están ambos accesibles.
  // Vite servirá los archivos estáticos de /public automáticamente.
  root: '.',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        clientMenu: resolve(__dirname, 'public/client/index.html'),
        clientCart: resolve(__dirname, 'public/client/cart.html'),
        clientCheckout: resolve(__dirname, 'public/client/checkout.html'),
        clientItemDetail: resolve(__dirname, 'public/client/item-detail.html'),
        clientTracking: resolve(__dirname, 'public/client/tracking.html'),
        adminLogin: resolve(__dirname, 'public/admin/login.html'),
        adminKDS: resolve(__dirname, 'public/admin/kds.html'),
        adminStock: resolve(__dirname, 'public/admin/stock.html'),
        adminHistory: resolve(__dirname, 'public/admin/history.html'),
        adminDetail: resolve(__dirname, 'public/admin/admin-detail.html'),
      },
    },
  },

  server: {
    port: 3000,
    open: '/public/client/index.html',
  },
});
