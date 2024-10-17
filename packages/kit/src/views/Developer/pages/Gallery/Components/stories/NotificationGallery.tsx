// eslint-disable-next-line no-restricted-syntax
// import React from 'react';

import { useState } from 'react';

import { Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ONEKEY_LOGO_ICON_URL } from '@onekeyhq/shared/src/consts';

import { Layout } from './utils/Layout';

const sampleBase64Icon =
  'data:image/png;base64,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';

let lastNotificationId: string | undefined;
function NotificationGallery() {
  console.log('NotificationGallery');
  const [icon, setIcon] = useState<string | undefined>(undefined);
  return (
    <Layout
      description=".."
      suggestions={['...']}
      boundaryConditions={['...']}
      elements={[
        {
          title: 'Default',
          element: (
            <>
              <Button onPress={() => setIcon(sampleBase64Icon)}>
                base64 icon
              </Button>
              <Button onPress={() => setIcon(ONEKEY_LOGO_ICON_URL)}>
                url icon
              </Button>
              <Button
                onPress={async () => {
                  const r =
                    await backgroundApiProxy.serviceNotification.showNotification(
                      {
                        title: 'test',
                        description: `test: ${new Date().getTime()}`,
                        icon,
                      },
                    );
                  lastNotificationId = r.notificationId;
                  console.log('serviceNotification.showNotification >>>> ', r);
                }}
              >
                Show Notification
              </Button>
              <Button
                onPress={async () => {
                  await backgroundApiProxy.serviceNotification.removeNotification(
                    {
                      notificationId: lastNotificationId,
                    },
                  );
                }}
              >
                Remove Last Notification
              </Button>
              <Button
                onPress={async () => {
                  await backgroundApiProxy.serviceNotification.showNotification(
                    {
                      title: 'test(main process)',
                      description: `test: ${new Date().getTime()}`,
                      showByElectronMainProcess: true,
                      icon,
                    },
                  );
                }}
              >
                Show Notification (desktop main process)
              </Button>
              <Button
                onPress={async () => {
                  await backgroundApiProxy.serviceNotification.showNotification(
                    {
                      title: 'test(Ext ui)',
                      description: `test: ${new Date().getTime()}`,
                      showByExtUiNotification: true,
                      icon,
                    },
                  );
                }}
              >
                Show Notification (Ext UI Notification)
              </Button>
              <Button
                onPress={() => {
                  // eslint-disable-next-line no-new
                  new Notification('1111', {
                    body: '2222',
                    icon: 'https://uni.onekey-asset.com/static/logo/onekey.png',
                  });
                }}
              >
                Web Notification by UI
              </Button>
              <Button
                onPress={async () => {
                  const p =
                    await backgroundApiProxy.serviceNotification.getPermission();
                  console.log('serviceNotification.getPermission >>>> ', p);
                }}
              >
                get Notification Permission
              </Button>
              <Button
                onPress={async () => {
                  const p =
                    await backgroundApiProxy.serviceNotification.requestPermission();
                  console.log('serviceNotification.requestPermission >>>> ', p);
                }}
              >
                request Notification Permission
              </Button>
              <Button
                onPress={async () => {
                  const p =
                    await backgroundApiProxy.serviceNotification.openPermissionSettings();
                  console.log(
                    'serviceNotification.openNotificationSettings >>>> ',
                    p,
                  );
                }}
              >
                open Notification Permission Settings
              </Button>
              <Button
                onPress={() => {
                  globalThis.desktopApi.callDevOnlyApi({
                    module: 'shell',
                    method: 'openExternal',
                    params: [
                      // 'https://www.baidu.com',
                      'x-apple.systempreferences:com.apple.preference.notifications',
                      'x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications',
                    ],
                  });
                }}
              >
                call Dev Only API
              </Button>
              <Button
                onPress={async () => {
                  await backgroundApiProxy.serviceNotification.setBadge({
                    count: Math.floor(Math.random() * 100),
                  });
                }}
              >
                set Badge
              </Button>

              <Button
                onPress={async () => {
                  await backgroundApiProxy.serviceNotification.clearBadge();
                }}
              >
                clear Badge
              </Button>
            </>
          ),
        },
      ]}
    />
  );
}

export default NotificationGallery;
