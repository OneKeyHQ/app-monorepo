import { useEffect, useRef } from 'react';

import { Button, ESwitchSize, Page, Stack, Switch } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePrimeCloudSyncPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

export default function PagePrimeCloudSync() {
  const [config] = usePrimeCloudSyncPersistAtom();
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.servicePrimeCloudSync.showAlertDialogIfLocalPasswordNotSet();
  }, []);
  const isSubmittingRef = useRef(false);

  return (
    <Page scrollEnabled>
      <Page.Header title="Cloud Sync" />
      <Page.Body>
        <Stack py="$2">
          <ListItem title="Enable Cloud Sync" subtitle="Enable cloud sync">
            <Switch
              disabled={false}
              size={ESwitchSize.small}
              onChange={async (value) => {
                if (isSubmittingRef.current) {
                  return;
                }
                try {
                  isSubmittingRef.current = true;
                  if (value) {
                    const {
                      success,
                      isServerMasterPasswordSet,
                      serverDiffItems,
                      encryptedSecurityPasswordR1ForServer,
                    } =
                      await backgroundApiProxy.servicePrimeCloudSync.enableCloudSync();
                    await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
                      success,
                    );
                    if (serverDiffItems?.length) {
                      console.log('serverDiffItems>>>', serverDiffItems);
                      return;
                    }
                    if (success) {
                      await backgroundApiProxy.serviceApp.showDialogLoading({
                        title: 'Syncing...',
                      });
                      try {
                        await timerUtils.wait(1000);
                        await backgroundApiProxy.servicePrimeCloudSync.startServerSyncFlow(
                          {
                            isFlush: !isServerMasterPasswordSet, // flush if server master password is not set
                            setUndefinedTimeToNow: true,
                            callerName: 'Enable Cloud Sync',
                            encryptedSecurityPasswordR1ForServer,
                          },
                        );
                      } finally {
                        await backgroundApiProxy.serviceApp.hideDialogLoading();
                      }
                    }
                  } else {
                    // disable cloud sync
                    await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
                      false,
                    );
                  }
                } catch (error) {
                  // disable cloud sync
                  await backgroundApiProxy.servicePrimeCloudSync.setCloudSyncEnabled(
                    false,
                  );
                  throw error;
                } finally {
                  isSubmittingRef.current = false;
                }
              }}
              value={config.isCloudSyncEnabled}
            />
          </ListItem>
        </Stack>

        {config?.isCloudSyncEnabled ? (
          <Button
            variant="primary"
            onPress={async () => {
              await backgroundApiProxy.serviceMasterPassword.startChangePassword();
            }}
          >
            Change Password
          </Button>
        ) : null}

        <Button
          onPress={() => {
            navigation.navigate(EPrimePages.PrimeCloudSyncDebug);
          }}
        >
          数据调试页面
        </Button>
      </Page.Body>
    </Page>
  );
}
