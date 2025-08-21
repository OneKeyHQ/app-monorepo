import { useCallback, useState } from 'react';

import { Dialog, Page, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export default function DesktopApiProxyTestDevSettings() {
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en-US');

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

  const testSystemReload = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.system.reload();
      Dialog.debugMessage({
        debugMessage: { result: 'reload() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemRestore = useCallback(async () => {
    try {
      await timerUtils.wait(2000);
      await globalThis.desktopApiProxy.system.restore();
      Dialog.debugMessage({
        debugMessage: { result: 'restore() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemQuitApp = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.system.quitApp();
      Dialog.debugMessage({
        debugMessage: { result: 'quitApp() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemFocus = useCallback(async () => {
    try {
      await timerUtils.wait(2000);
      await globalThis.desktopApiProxy.system.focus();
      Dialog.debugMessage({
        debugMessage: { result: 'focus() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemIsFocused = useCallback(async () => {
    try {
      // await globalThis.desktopApiProxy.system.isFocused();
      const result = globalThis.desktopApi.isFocused();
      Dialog.debugMessage({
        debugMessage: { isFocused: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemToggleMaximizeWindow = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.system.toggleMaximizeWindow();
      Dialog.debugMessage({
        debugMessage: { result: 'toggleMaximizeWindow() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testDevChangeDevTools = useCallback(async () => {
    try {
      const newState = !devToolsEnabled;
      await globalThis.desktopApiProxy.dev.changeDevTools(newState);
      setDevToolsEnabled(newState);
      Dialog.debugMessage({
        debugMessage: {
          result: `changeDevTools(${newState.toString()}) called successfully`,
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, [devToolsEnabled]);

  const testSystemChangeLanguage = useCallback(async () => {
    try {
      const newLanguage = currentLanguage === 'en-US' ? 'zh-CN' : 'en-US';
      await globalThis.desktopApiProxy.system.changeLanguage(newLanguage);
      setCurrentLanguage(newLanguage);
      Dialog.debugMessage({
        debugMessage: {
          result: `changeLanguage(${newLanguage}) called successfully`,
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, [currentLanguage]);

  // New system methods tests
  const testSystemGetVersion = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.system.getVersion();
      Dialog.debugMessage({
        debugMessage: { version: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemGetEnvPath = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.system.getEnvPath();
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemGetBundleInfo = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.system.getBundleInfo();
      Dialog.debugMessage({
        debugMessage: result,
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemOpenLoggerFile = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.system.openLoggerFile();
      Dialog.debugMessage({
        debugMessage: { result: 'openLoggerFile() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemReloadBridgeProcess = useCallback(async () => {
    try {
      const result =
        await globalThis.desktopApiProxy.system.reloadBridgeProcess();
      Dialog.debugMessage({
        debugMessage: {
          result: 'reloadBridgeProcess() called successfully',
          returnValue: result,
        },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSystemGetAppName = useCallback(async () => {
    try {
      const result = await globalThis.desktopApiProxy.system.getAppName();
      Dialog.debugMessage({
        debugMessage: { appName: result },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Security Tests
  const testSecurityCanPromptTouchID = useCallback(async () => {
    try {
      const result =
        await globalThis.desktopApiProxy.security.canPromptTouchID();
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

  // Storage Tests - Individual Methods
  const testStorageSetItem = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.storage.storeSetItemAsync(
        'testKey' as any,
        'testValue',
      );
      Dialog.debugMessage({
        debugMessage: { result: 'storeSetItemAsync() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testStorageGetItem = useCallback(async () => {
    try {
      const value = await globalThis.desktopApiProxy.storage.storeGetItemAsync(
        'testKey' as any,
      );
      Dialog.debugMessage({
        debugMessage: { getValue: value },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testStorageDelItem = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.storage.storeDelItemAsync(
        'testKey' as any,
      );
      Dialog.debugMessage({
        debugMessage: { result: 'storeDelItemAsync() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testStorageClear = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.storage.storeClear();
      Dialog.debugMessage({
        debugMessage: { result: 'storeClear() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSecureSetItem = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.storage.secureSetItemAsync(
        'test_secure_key',
        'test_secure_value',
      );
      Dialog.debugMessage({
        debugMessage: { result: 'secureSetItemAsync() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSecureGetItem = useCallback(async () => {
    try {
      const value = await globalThis.desktopApiProxy.storage.secureGetItemAsync(
        'test_secure_key',
      );
      Dialog.debugMessage({
        debugMessage: { secureValue: value },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testSecureDelItem = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.storage.secureDelItemAsync(
        'test_secure_key',
      );
      Dialog.debugMessage({
        debugMessage: { result: 'secureDelItemAsync() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  // Webview Tests
  const testNetworkSetAllowedPhishingUrls = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.webview.setAllowedPhishingUrls([
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
  const testNotificationShow = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.notification.showNotification({
        title: 'Test Notification',
        description: 'This is a test notification from DesktopApiProxy',
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

  const testNotificationSetBadge = useCallback(async () => {
    try {
      const count = Math.floor(Math.random() * 10);
      await globalThis.desktopApiProxy.notification.setBadge({
        count,
      });
      Dialog.debugMessage({
        debugMessage: { result: `setBadge(${count}) called successfully` },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testNotificationGetPermission = useCallback(async () => {
    try {
      const result =
        await globalThis.desktopApiProxy.notification.getNotificationPermission();
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
  const testDevOpenLoggerFile = useCallback(async () => {
    try {
      await globalThis.desktopApiProxy.dev.openLoggerFile();
      Dialog.debugMessage({
        debugMessage: { result: 'openLoggerFile() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testDevTestCrash = useCallback(async () => {
    try {
      // TODO: desktopApiProxy.dev.testCrash() not working
      // await globalThis.desktopApiProxy.dev.testCrash();
      globalThis.desktopApi.testCrash();
      Dialog.debugMessage({
        debugMessage: { result: 'testCrash() called successfully' },
      });
    } catch (error) {
      Dialog.debugMessage({
        debugMessage: { error: (error as Error)?.message },
      });
    }
  }, []);

  const testDevCallDevOnlyApi = useCallback(async () => {
    try {
      // Test with shell.openExternal
      const result = await globalThis.desktopApiProxy.dev.callDevOnlyApi({
        module: 'shell',
        method: 'openExternal',
        params: [
          // 'https://onekey.so',
          // 'https://www.baidu.com',
          'x-apple.systempreferences:com.apple.preference.notifications',
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Notifications',
        ],
      });
      Dialog.debugMessage({
        debugMessage: {
          result: 'callDevOnlyApi() called successfully',
          returnValue: result,
        },
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
      <Page.Header title="DesktopApiProxyTestDevSettings" />
      <YStack gap="$2">
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
          title="reload()"
          subtitle="Reload application"
          drillIn
          onPress={testSystemReload}
        />

        <ListItem
          title="quitApp()"
          subtitle="Quit application"
          drillIn
          onPress={testSystemQuitApp}
        />

        <ListItem
          title="restore()"
          subtitle="Restore application, wait 2 seconds"
          drillIn
          onPress={testSystemRestore}
        />

        <ListItem
          title="focus()"
          subtitle="Focus application window, wait 2 seconds"
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
          title={`changeLanguage(${
            currentLanguage === 'en-US' ? 'zh-CN' : 'en-US'
          })`}
          subtitle="Toggle application language"
          drillIn
          onPress={testSystemChangeLanguage}
        />

        <ListItem
          title="toggleMaximizeWindow()"
          subtitle="Toggle window maximize state"
          drillIn
          onPress={testSystemToggleMaximizeWindow}
        />

        <ListItem
          title="openPreferences('notification')"
          subtitle="Open notification preferences"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.system.openPreferences(
                'notification',
              );
              Dialog.debugMessage({
                debugMessage: {
                  result: 'openPreferences() called successfully',
                },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        <ListItem
          title="openPreferences('default')"
          subtitle="Open security preferences"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.system.openPreferences(
                'default',
              );

              Dialog.debugMessage({
                debugMessage: {
                  result: 'openPreferences() called successfully',
                },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        <ListItem
          title="openPrivacyPanel()"
          subtitle="Open privacy panel"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.system.openPrivacyPanel();
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        <ListItem
          title="getMediaAccessStatus('camera')"
          subtitle="Get camera access status"
          drillIn
          onPress={async () => {
            try {
              const result =
                await globalThis.desktopApiProxy.system.getMediaAccessStatus(
                  'camera',
                );
              Dialog.debugMessage({
                debugMessage: { result },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        <ListItem
          title="getVersion()"
          subtitle="Get application version"
          drillIn
          onPress={testSystemGetVersion}
        />

        <ListItem
          title="getEnvPath()"
          subtitle="Get environment paths"
          drillIn
          onPress={testSystemGetEnvPath}
        />

        <ListItem
          title="getBundleInfo()"
          subtitle="Get bundle information (Mac only)"
          drillIn
          onPress={testSystemGetBundleInfo}
        />

        <ListItem
          title="openLoggerFile()"
          subtitle="Open logger file directory"
          drillIn
          onPress={testSystemOpenLoggerFile}
        />

        <ListItem
          title="reloadBridgeProcess()"
          subtitle="Reload bridge process"
          drillIn
          onPress={testSystemReloadBridgeProcess}
        />

        <ListItem
          title="getAppName()"
          subtitle="Get application name"
          drillIn
          onPress={testSystemGetAppName}
        />

        <ListItem
          title="disableShortcuts()"
          subtitle="Disable keyboard shortcuts"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.system.disableShortcuts({
                disableAllShortcuts: true,
              });
              Dialog.debugMessage({
                debugMessage: {
                  result: 'disableShortcuts() called successfully',
                },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
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
          title="checkBiometricAuthChanged()"
          subtitle="Check if biometric auth changed (macOS)"
          drillIn
          onPress={async () => {
            try {
              const result =
                await globalThis.desktopApiProxy.security.checkBiometricAuthChanged();
              Dialog.debugMessage({
                debugMessage: { biometricAuthChanged: result },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        {/* Storage Module Tests */}
        <ListItem
          title="💾 Storage Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="storeSetItemAsync()"
          subtitle="Set item in desktop store"
          drillIn
          onPress={testStorageSetItem}
        />

        <ListItem
          title="storeGetItemAsync()"
          subtitle="Get item from desktop store"
          drillIn
          onPress={testStorageGetItem}
        />

        <ListItem
          title="storeDelItemAsync()"
          subtitle="Delete item from desktop store"
          drillIn
          onPress={testStorageDelItem}
        />

        <ListItem
          title="storeClear()"
          subtitle="Clear all store data"
          drillIn
          onPress={testStorageClear}
        />

        <ListItem
          title="secureSetItemAsync()"
          subtitle="Set item in secure storage"
          drillIn
          onPress={testSecureSetItem}
        />

        <ListItem
          title="secureGetItemAsync()"
          subtitle="Get item from secure storage"
          drillIn
          onPress={testSecureGetItem}
        />

        <ListItem
          title="secureDelItemAsync()"
          subtitle="Delete item from secure storage"
          drillIn
          onPress={testSecureDelItem}
        />

        {/* Webview Module Tests */}
        <ListItem
          title="🌐 Webview Module"
          titleProps={{ color: '$textInfo', size: '$headingLg' }}
        />

        <ListItem
          title="setAllowedPhishingUrls()"
          subtitle="Set allowed phishing URLs"
          drillIn
          onPress={testNetworkSetAllowedPhishingUrls}
        />

        <ListItem
          title="clearWebViewCache()"
          subtitle="Clear webview cache and cookies"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.webview.clearWebViewCache();
              Dialog.debugMessage({
                debugMessage: {
                  result: 'clearWebViewCache() called successfully',
                },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
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
          title="setBadge(random)"
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

        <ListItem
          title="openPermissionSettings()"
          subtitle="Open notification permission settings"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.notification.openPermissionSettings();
              Dialog.debugMessage({
                debugMessage: {
                  result: 'openPermissionSettings() called successfully',
                },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
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

        <ListItem
          title="testCrash()"
          subtitle="Test application crash (will crash the app!)"
          drillIn
          onPress={testDevTestCrash}
        />

        <ListItem
          title="callDevOnlyApi()"
          subtitle="Call dev-only API (opens onekey.so)"
          drillIn
          onPress={testDevCallDevOnlyApi}
        />

        <ListItem
          title={`changeDevTools(${(!devToolsEnabled).toString()})`}
          subtitle="Toggle application development tools"
          drillIn
          onPress={testDevChangeDevTools}
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

        <ListItem
          title="testDelay()"
          subtitle="Test delay"
          drillIn
          onPress={async () => {
            try {
              const result =
                await globalThis.desktopApiProxy.inAppPurchase.testDelay();
              Dialog.debugMessage({
                debugMessage: { canMakePayments: result },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />

        <ListItem
          title="testError()"
          subtitle="Test error"
          drillIn
          onPress={async () => {
            try {
              await globalThis.desktopApiProxy.inAppPurchase.testError();
              Dialog.debugMessage({
                debugMessage: { result: 'testError() called successfully' },
              });
            } catch (error) {
              Dialog.debugMessage({
                debugMessage: { error: (error as Error)?.message },
              });
            }
          }}
        />
      </YStack>
    </Page>
  );
}
