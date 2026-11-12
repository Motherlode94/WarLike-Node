import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',timeout:60000,use:{baseURL:'http://127.0.0.1:8766',browserName:'chromium',headless:true,acceptDownloads:true},webServer:{command:'python3 -m http.server 8766 --bind 127.0.0.1',url:'http://127.0.0.1:8766',reuseExistingServer:!process.env.CI}});
