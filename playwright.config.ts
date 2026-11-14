import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:'**/*.pw.ts',fullyParallel:false,workers:1,timeout:45000,
  use:{baseURL:'http://localhost:3101',reducedMotion:'reduce',trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1365,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
  webServer:{command:'bun run start -- --port 3101',url:'http://localhost:3101',reuseExistingServer:true,timeout:60000},
});
