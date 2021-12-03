import React, { useEffect, useState } from 'react';
import {
  NativeModules,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  NativeEventEmitter,
  EmitterSubscription,
  Platform,
} from 'react-native';
import { Box, Button, Center } from '@onekeyhq/components';
import { Provider } from '@onekeyhq/kit';
import DeviceInfo from 'react-native-device-info';
import AppUpdates, { AppUpdateState } from './AppUpdates';

export default function WebViewDemo(): JSX.Element {
  const appUpdates = new AppUpdates();

  const [versionCode, setVersionCode] = useState('');
  const [versionName, setVersionName] = useState('');
  const [updateState, setUpdateState] = useState('');
  const [existsUpdate, setExistsUpdate] = useState(false);
  const [canCancelUpdate, setCanCancelUpdate] = useState(false);
  const [canInstallUpdate, setCanInstallUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState('');
  const [updateInstallState, setUpdateInstallState] = useState('');

  useEffect(() => {
    setVersionCode(DeviceInfo.getBuildNumber());
    setVersionName(DeviceInfo.getVersion());
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const eventEmitter = appUpdates.on();
    eventEmitter.addListener('update_progress_event', (event) => {
      setUpdateProgress(JSON.stringify(event));
    });
    eventEmitter.addListener('update_install_event', (event) => {
      setUpdateInstallState(event);
      console.log('====', event);

      switch (event) {
        case AppUpdateState.DOWNLOADING:
          setCanCancelUpdate(true);
          break;

        case AppUpdateState.DOWNLOADED:
          setCanCancelUpdate(false);
          setCanInstallUpdate(true);
          break;

        default:
          break;
      }
    });

    return () => {
      eventEmitter.removeAllListeners('update_progress_event');
      eventEmitter.removeAllListeners('update_install_event');
    };
  }, []);

  return (
    <Provider language="en">
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

              <Box>updateInstallState:{updateInstallState}</Box>
              <Box>updateProgress:{updateProgress}</Box>
            </Center>
          ) : null}

          {canCancelUpdate ? (
            <Center>
              <Button
                onPress={() => {
                  appUpdates
                    .cancelUpdate()
                    .then(() => {
                      console.log('Cancel the success');
                    })
                    .catch(() => {
                      console.log('Cancel the failure');
                    });
                }}
              >
                取消升级
              </Button>
            </Center>
          ) : null}

          {canInstallUpdate ? (
            <Center>
              <Button
                onPress={() => {
                  appUpdates
                    .installUpdate()
                    .then((result) => {
                      console.log(JSON.stringify(result));
                    })
                    .catch((error) => {
                      console.log(error);
                    });
                }}
              >
                安装升级
              </Button>
            </Center>
          ) : null}
        </Center>
      </Box>
    </Provider>
  );
}
