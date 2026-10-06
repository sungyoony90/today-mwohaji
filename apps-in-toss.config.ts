import { defineConfig } from '@apps-in-toss/web-framework/config';

// SDK 3.x reads this file, not the legacy granite.config.ts.
// Display name and icon are managed in the Apps-in-Toss console in SDK 3.x.
export default defineConfig({
  appName: 'summer-mwohaji',
  brand: { primaryColor: '#407d5e' },
  permissions: [
    { name: 'camera', access: 'access' },
    { name: 'photos', access: 'read' },
    { name: 'geolocation', access: 'access' },
  ],
  webBundleDir: 'dist',
});
