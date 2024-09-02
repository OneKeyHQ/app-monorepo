import platformEnv from '../platformEnv';
import { headerPlatform } from '../request/Interceptor';

import { getDeviceInfo } from './deviceInfo';
import { firebaseConfig } from './firebaseConfig';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

async function getOrCreateClientId() {
  if (platformEnv.isExtension) {
    const result = await chrome.storage.local.get('clientId');
    let clientId = result.clientId as string;
    if (!clientId) {
      // Generate a unique client ID, the actual value is not relevant
      clientId = globalThis.crypto.randomUUID();
      await chrome.storage.local.set({ clientId });
    }
    return clientId;
  }
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    // Generate a unique client ID, the actual value is not relevant
    clientId = globalThis.crypto.randomUUID();
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}

async function getBasicInfo() {
  const deviceInfo = await getDeviceInfo();
  const platform = headerPlatform;
  const appBuildNumber = platformEnv.buildNumber;
  const appVersion = platformEnv.version;
  return { ...deviceInfo, platform, appBuildNumber, appVersion };
}

async function collectData(
  eventName: string,
  params?: Record<string, unknown>,
) {
  return fetch(
    `${GA_ENDPOINT}?measurement_id=${firebaseConfig.measurementId}&api_secret=${
      (
        firebaseConfig as {
          measurementId: string;
          apiSecret: string;
        }
      ).apiSecret
    }`,
    {
      method: 'POST',
      body: JSON.stringify({
        client_id: params?.instanceId || (await getOrCreateClientId()),
        events: [
          {
            name: eventName,
            params: {
              ...(await getBasicInfo()),
              ...params,
            },
          },
        ],
      }),
    },
  );
}

export const analyticLogEvent = (
  eventName: string,
  eventParams?: {
    [key: string]: unknown;
  },
) => {
  //   if (!platformEnv.isProduction || !firebaseConfig.apiKey) {
  //     return;
  //   }
  void collectData(eventName, eventParams);
};
