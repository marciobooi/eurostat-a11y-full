const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('a11yDesktop', {
  platform: process.platform,
  isDesktop: true
});
