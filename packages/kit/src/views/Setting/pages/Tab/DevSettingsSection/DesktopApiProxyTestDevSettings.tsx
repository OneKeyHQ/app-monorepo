import { useCallback } from 'react';

import { Dialog, Page, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export default function DesktopApiProxyTestDevSettings() {
  // System Tests
  const testSystemGetSystemInfo = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.system.getSystemInfo();
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemReady = useCallback(() => {
    try {
      globalThis.desktopApiProxy.system.ready();
      Dialog.debugMessage({
        debugMessage: { result: 'ready() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemReload = useCallback(() => {
    try {
      globalThis.desktopApiProxy.system.reload();
      Dialog.debugMessage({
        debugMessage: { result: 'reload() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemFocus = useCallback(() => {
    try {
      globalThis.desktopApiProxy.system.focus();
      Dialog.debugMessage({
        debugMessage: { result: 'focus() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemIsFocused = useCallback(() => {
    try {
      const result = globalThis.desktopApiProxy.system.isFocused();
      Dialog.debugMessage({
        debugMessage: { isFocused: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemToggleMaximizeWindow = useCallback(() => {
    try {
      globalThis.desktopApiProxy.system.toggleMaximizeWindow();
      Dialog.debugMessage({
        debugMessage: { result: 'toggleMaximizeWindow() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemChangeTheme = useCallback(() => {
    try {
      globalThis.desktopApiProxy.system.changeTheme('dark');
      Dialog.debugMessage({
        debugMessage: { result: 'changeTheme(dark) called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Security Tests
  const testSecurityCanPromptTouchID = useCallback(() => {
    try {
      const result = globalThis.desktopApiProxy.security.canPromptTouchID();
      Dialog.debugMessage({
        debugMessage: { canPromptTouchID: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSecurityPromptTouchID = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.security.promptTouchID(
        'Test authentication',
      );
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSecuritySecureStorage = useCallback(async () => {
    try {
      // Test set
      await globalThis.desktopApiProxy.security.secureSetItemAsync(
        'test_key',
        'test_value',
      );

      // Test get
      const value =
        await globalThis.desktopApiProxy.security.secureGetItemAsync(
          'test_key',
        );

      // Test delete
      await globalThis.desktopApiProxy.security.secureDelItemAsync('test_key');

      Dialog.debugMessage({
        debugMessage: {
          setValue: 'test_value',
          getValue: value,
          deleteResult: 'success',
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Storage Tests
  const testStorageOperations = useCallback(async () => {
    try {
      // Test set
      await globalThis.desktopApiProxy.storage.storeSetItemAsync(
        'testKey',
        'testValue',
      );

      // Test get
      const value = await globalThis.desktopApiProxy.storage.storeGetItemAsync(
        'testKey',
      );

      // Test delete
      await globalThis.desktopApiProxy.storage.storeDelItemAsync('testKey');

      Dialog.debugMessage({
        debugMessage: {
          setValue: 'testValue',
          getValue: value,
          deleteResult: 'success',
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Updater Tests
  const testUpdaterCheckForUpdates = useCallback(() => {
    try {
      globalThis.desktopApiProxy.updater.checkForUpdates(true);
      Dialog.debugMessage({
        debugMessage: { result: 'checkForUpdates(true) called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testUpdaterGetPreviousUpdateBuildNumber = useCallback(() => {
    try {
      const result =
        globalThis.desktopApiProxy.updater.getPreviousUpdateBuildNumber();
      Dialog.debugMessage({
        debugMessage: { previousUpdateBuildNumber: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Network Tests
  const testNetworkSetAllowedPhishingUrls = useCallback(() => {
    try {
      globalThis.desktopApiProxy.network.setAllowedPhishingUrls([
        'https://test.com',
      ]);
      Dialog.debugMessage({
        debugMessage: {
          result: 'setAllowedPhishingUrls() called successfully',
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Notification Tests
  const testNotificationShow = useCallback(() => {
    try {
      globalThis.desktopApiProxy.notification.showNotification({
        title: 'Test Notification',
        body: 'This is a test notification from DesktopApiProxy',
      });
      Dialog.debugMessage({
        debugMessage: { result: 'showNotification() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testNotificationSetBadge = useCallback(() => {
    try {
      globalThis.desktopApiProxy.notification.setBadge({ count: 5 });
      Dialog.debugMessage({
        debugMessage: { result: 'setBadge(5) called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testNotificationGetPermission = useCallback(() => {
    try {
      const result =
        globalThis.desktopApiProxy.notification.getNotificationPermission();
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Dev Tests
  const testDevOpenLoggerFile = useCallback(() => {
    try {
      globalThis.desktopApiProxy.dev.openLoggerFile();
      Dialog.debugMessage({
        debugMessage: { result: 'openLoggerFile() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // InAppPurchase Tests
  const testInAppPurchaseGetProducts = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.inAppPurchase.getProducts(
        {
          productIDs: ['Prime_Yearly', 'Prime_Monthly'],
        },
      );
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testInAppPurchaseCanMakePayments = useCallback(async () => {
    try {
      const result =
        await globalThis.desktopApiProxy.inAppPurchase.canMakePayments();
      Dialog.debugMessage({
        debugMessage: { canMakePayments: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  if (!platformEnv.isDesktop) {
    return (
      <YStack p="$4">
        <ListItem
          title="Desktop API Proxy is only available on Desktop"
          titleProps={{ color: '$textCritical' }}
        />
      </YStack>
    );
  }

  return (
    <Page scrollEnabled>
      <Page.Header title="FirmwareUpdateDevSettings" />
      <YStack space="$2">
        {/* System Module Tests */}
        <ListItem
          title="🖥️ System Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="getSystemInfo()"
          subtitle="Get system information"
          drillIn
          onPress={testSystemGetSystemInfo}
        />

        <ListItem
          title="ready()"
          subtitle="Signal app ready"
          drillIn
          onPress={testSystemReady}
        />

        <ListItem
          title="reload()"
          subtitle="Reload application"
          drillIn
          onPress={testSystemReload}
        />

        <ListItem
          title="focus()"
          subtitle="Focus application window"
          drillIn
          onPress={testSystemFocus}
        />

        <ListItem
          title="isFocused()"
          subtitle="Check if window is focused"
          drillIn
          onPress={testSystemIsFocused}
        />

        <ListItem
          title="toggleMaximizeWindow()"
          subtitle="Toggle window maximize state"
          drillIn
          onPress={testSystemToggleMaximizeWindow}
        />

        <ListItem
          title="changeTheme('dark')"
          subtitle="Change application theme"
          drillIn
          onPress={testSystemChangeTheme}
        />

        {/* Security Module Tests */}
        <ListItem
          title="🔐 Security Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="canPromptTouchID()"
          subtitle="Check TouchID availability"
          drillIn
          onPress={testSecurityCanPromptTouchID}
        />

        <ListItem
          title="promptTouchID()"
          subtitle="Prompt TouchID authentication"
          drillIn
          onPress={testSecurityPromptTouchID}
        />

        <ListItem
          title="Secure Storage Test"
          subtitle="Test secure set/get/delete operations"
          drillIn
          onPress={testSecuritySecureStorage}
        />

        {/* Storage Module Tests */}
        <ListItem
          title="💾 Storage Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="Storage Operations Test"
          subtitle="Test store set/get/delete operations"
          drillIn
          onPress={testStorageOperations}
        />

        {/* Updater Module Tests */}
        <ListItem
          title="🔄 Updater Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="checkForUpdates(true)"
          subtitle="Check for updates manually"
          drillIn
          onPress={testUpdaterCheckForUpdates}
        />

        <ListItem
          title="getPreviousUpdateBuildNumber()"
          subtitle="Get previous update build number"
          drillIn
          onPress={testUpdaterGetPreviousUpdateBuildNumber}
        />

        {/* Network Module Tests */}
        <ListItem
          title="🌐 Network Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="setAllowedPhishingUrls()"
          subtitle="Set allowed phishing URLs"
          drillIn
          onPress={testNetworkSetAllowedPhishingUrls}
        />

        {/* Notification Module Tests */}
        <ListItem
          title="📢 Notification Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="showNotification()"
          subtitle="Show desktop notification"
          drillIn
          onPress={testNotificationShow}
        />

        <ListItem
          title="setBadge(5)"
          subtitle="Set application badge count"
          drillIn
          onPress={testNotificationSetBadge}
        />

        <ListItem
          title="getNotificationPermission()"
          subtitle="Get notification permission status"
          drillIn
          onPress={testNotificationGetPermission}
        />

        {/* Dev Module Tests */}
        <ListItem
          title="🔍 Dev Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="openLoggerFile()"
          subtitle="Open application log file"
          drillIn
          onPress={testDevOpenLoggerFile}
        />

        {/* InAppPurchase Module Tests */}
        <ListItem
          title="💳 InAppPurchase Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="getProducts()"
          subtitle="Get available products"
          drillIn
          onPress={testInAppPurchaseGetProducts}
        />

        <ListItem
          title="canMakePayments()"
          subtitle="Check if payments are available"
          drillIn
          onPress={testInAppPurchaseCanMakePayments}
        />
      </YStack>
    </Page>
  );
}
