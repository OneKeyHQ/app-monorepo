/* eslint-disable no-template-curly-in-string */
require('../../development/env');
const baseElectronBuilderConfig = require('./electron-builder-base.config');

module.exports = {
  ...baseElectronBuilderConfig,
  linux: {
    extraResources: [
      {
        from: 'app/build/static/bin/bridge/linux-${arch}',
        to: 'bin/bridge',
      },
    ],
    icon: 'app/build/static/images/icons/512x512.png',
    artifactName: 'OneKey-Wallet-${version}-linux-flatpak.${ext}',
    executableName: 'onekey-wallet',
    category: 'Utility',
    target: [{ target: 'flatpak', arch: ['x64'] }],
  },
  flatpak: {
    runtime: 'org.freedesktop.Platform',
    runtimeVersion: '22.08',
    sdk: 'org.freedesktop.Sdk',
    base: 'org.electronjs.Electron2.BaseApp',
    baseVersion: '22.08',
    finishArgs: [
      '--share=network',
      '--share=ipc',
      '--socket=x11',
      '--socket=wayland',
      '--device=all',
      '--filesystem=home',
      '--talk-name=org.freedesktop.Notifications',
    ],
  },
};
