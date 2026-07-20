import { useEffect } from 'react';

import { openSettings as linkingOpenSettings } from 'expo-linking';
import { Button, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import UUID from 'react-native-uuid';

import sdk from './expoNotificationSdk';
import jpush from './jpushSdk';
// import sdk from './notifeeSdk';

let isInited = false;
export function DemoPushKitProvider() {
  useEffect(() => {
    if (isInited) {
      return;
    }
    isInited = true;
    void sdk.init();
    void jpush.init();
  }, []);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Button
            testID="provider-demo-push-kit-provider-btn"
            title="打开权限设置"
            onPress={() => {
              void linkingOpenSettings();
            }}
          />
          <Button
            testID="provider-demo-push-kit-provider-btn"
            title="显示本地通知"
            onPress={async () => {
              const uuid = UUID.v4() as string;
              await sdk.showNotification({
                title: 'hello',
                content: `world: ${Date.now()}`,
                uuid,
              });
            }}
          />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
