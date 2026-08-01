#!/usr/bin/env node
/* eslint-disable no-console, onekey/no-raw-error -- standalone hardware diagnostic helper */

import { connectToOneKey, screenshot, writeJsonArtifact } from './cdp.mjs';

const { page } = await connectToOneKey();

const report = await page.evaluate(async () => {
  const api = globalThis.$$appGlobals?.$backgroundApiProxy;
  if (!api) {
    throw new Error('backgroundApiProxy is not available');
  }

  const serializeError = (error) => {
    if (!error || typeof error !== 'object') {
      return { value: String(error) };
    }
    const source = error;
    const output = {};
    for (const key of new Set([
      ...Object.keys(source),
      ...Object.getOwnPropertyNames(source),
    ])) {
      const value = source[key];
      if (typeof value !== 'function') {
        output[key] = value;
      }
    }
    return output;
  };

  const wallets = await api.serviceAccount.getAllHwQrWalletWithDevice({
    filterHiddenWallet: true,
  });
  const walletSummaries = Object.entries(wallets || {}).map(
    ([walletId, item]) => ({
      walletId,
      walletName: item?.wallet?.name,
      device: item?.device
        ? {
            id: item.device.id,
            connectId: item.device.connectId,
            bleConnectId: item.device.bleConnectId,
            uuid: item.device.uuid,
            deviceType: item.device.deviceType,
            name: item.device.name,
            bleName: item.device.bleName || item.device.featuresInfo?.bleName,
            featureKeys: Object.keys(item.device.featuresInfo || {}),
          }
        : undefined,
    }),
  );
  const candidates = Object.entries(wallets || {})
    .filter(([, item]) => {
      const device = item?.device;
      return (
        String(device?.deviceType || '').toLowerCase() === 'pro2' ||
        String(device?.bleName || device?.featuresInfo?.bleName || '')
          .toLowerCase()
          .includes('pro2')
      );
    })
    .map(([walletId, item]) => ({ walletId, item }));

  const selected = candidates[0];
  const device = selected?.item?.device;
  if (!selected || !device?.connectId) {
    return {
      walletSummaries,
      candidates: candidates.map(({ walletId, item }) => ({
        walletId,
        deviceType: item?.device?.deviceType,
        connectId: item?.device?.connectId,
        bleConnectId: item?.device?.bleConnectId,
        bleName: item?.device?.featuresInfo?.bleName,
      })),
      error: 'No Pro2 wallet with connectId found',
    };
  }

  const [currentTransportType, configuredTransportType, usbAvailable] =
    await Promise.all([
      api.serviceHardware.getCurrentTransportType().catch(serializeError),
      api.serviceSetting.getHardwareTransportType().catch(serializeError),
      api.serviceHardware.detectUSBDeviceAvailability().catch(serializeError),
    ]);

  let stateResult;
  try {
    const state = await api.serviceHardware.getDeviceState({
      connectId: device.connectId,
      silentMode: true,
    });
    stateResult = {
      success: true,
      protocol: state?.protocol,
      identity: state?.identity,
      status: state?.status,
    };
  } catch (error) {
    stateResult = { success: false, error: serializeError(error) };
  }

  return {
    walletId: selected.walletId,
    device: {
      id: device.id,
      connectId: device.connectId,
      bleConnectId: device.bleConnectId,
      uuid: device.uuid,
      deviceType: device.deviceType,
      bleName: device.featuresInfo?.bleName,
      protocol: device.deviceStateInfo?.protocol,
    },
    transport: {
      currentTransportType,
      configuredTransportType,
      usbAvailable,
    },
    stateResult,
  };
});

const screenshotPath = await screenshot(page, 'diagnose-device-connection.png');
const reportPath = await writeJsonArtifact(
  'diagnose-device-connection.json',
  report,
);

console.log(JSON.stringify({ report, reportPath, screenshotPath }, null, 2));
process.exit(report.stateResult?.success ? 0 : 1);
