import { useEffect } from 'react';

import { openSettings as linkingOpenSettings } from 'expo-linking';
import { Button, SafeAreaView, View } from 'react-native';
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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Button
          title="打开权限设置"
          onPress={() => {
            void linkingOpenSettings();
          }}
        />
        <Button
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
  );
}
