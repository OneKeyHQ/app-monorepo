import React, { useEffect, useState } from 'react';
import { Box, Button, Center } from '@onekeyhq/components';
import { Provider } from '@onekeyhq/kit';
import DeviceInfo from 'react-native-device-info';
import AppUpdates from './AppUpdates';

export default function WebViewDemo(): JSX.Element {
  const appUpdates = new AppUpdates();

  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [updateState, setUpdateState] = useState('');
  const [existsUpdate, setExistsUpdate] = useState(false);

  useEffect(() => {
    setVersionCode(DeviceInfo.getBuildNumber());
    setVersionName(DeviceInfo.getVersion());
  }, []);

  return (
    <Provider>
      <Box flex={1} safeArea>
        <Center>
          <Box>versionCode: {versionCode}</Box>
          <Box>versionName: {versionName}</Box>
          <Button
            onPress={() => {
              appUpdates
                .checkAppUpdate()
                .then((result) => {
                  setExistsUpdate(true);
                  setUpdateState(JSON.stringify(result));
                })
                .catch((error) => {
                  setExistsUpdate(false);
                  console.log(error);
                  setUpdateState(JSON.stringify(error));
                });
            }}
          >
            检查更新
          </Button>

          <Box>{updateState}</Box>

          {existsUpdate ? (
            <Center>
              <Button
                onPress={() => {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  const updateInfo: any = JSON.parse(updateState);
                  appUpdates
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    .updateApp(updateInfo.updateType, updateInfo.appStoreUrl)
                    .then((result) => {
                      setExistsUpdate(true);
                      setUpdateState(JSON.stringify(result));
                    })
                    .catch((error) => {
                      setExistsUpdate(false);
                      console.log(error);
                      setUpdateState(JSON.stringify(error));
                    });
                }}
              >
                升级
              </Button>
            </Center>
          ) : null}
        </Center>
      </Box>
    </Provider>
  );
}
