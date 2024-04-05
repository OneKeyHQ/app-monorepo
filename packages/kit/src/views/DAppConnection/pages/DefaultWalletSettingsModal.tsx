import { useCallback } from 'react';

import { isNil } from 'lodash';

import {
  Divider,
  Image,
  Page,
  Skeleton,
  Stack,
  Switch,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

function EmptyGuide() {
  return (
    <Stack
      w="100%"
      px={22}
      py="$2.5"
      alignItems="center"
      justifyContent="center"
    >
      <Image
        w="$80"
        h={341}
        source={require('@onekeyhq/kit/assets/extension_menu.png')}
      />
    </Stack>
  );
}

function DefaultWalletSettingsModal() {
  const { result, run } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceContextMenu.getDefaultWalletSettingsWithIcon(),
    [],
  );

  const setIsDefaultWallet = useCallback(async (val: boolean) => {
    await backgroundApiProxy.serviceContextMenu.setIsDefaultWallet(val);
  }, []);

  const refreshContextMenu = useCallback(() => {
    if (!platformEnv.isExtension) return;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        try {
          const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
          void backgroundApiProxy.serviceContextMenu.updateAndNotify(
            currentOrigin,
          );
        } catch (e) {
          console.error('refreshContextMenu error:', e);
        }
      }
    });
  }, []);

  const removeExcludedDApp = useCallback(
    async (origin: string) => {
      await backgroundApiProxy.serviceContextMenu.removeExcludedDApp(origin);
      void run();
    },
    [run],
  );

  const renderList = useCallback(() => {
    if (isNil(result?.excludedDappListWithLogo)) {
      return null;
    }
    if (result.excludedDappListWithLogo.length === 0) {
      return <EmptyGuide />;
    }
    return result.excludedDappListWithLogo.map((i) => (
      <ListItem
        key={i.origin}
        title={i.origin}
        avatarProps={{
          src: i.logo,
          fallbackProps: {
            children: <Skeleton w="$10" h="$10" />,
          },
        }}
        onPress={() => removeExcludedDApp(i.origin)}
      >
        <ListItem.IconButton
          icon="DeleteOutline"
          iconProps={{
            color: '$iconSubdued',
          }}
        />
      </ListItem>
    ));
  }, [result?.excludedDappListWithLogo, removeExcludedDApp]);

  return (
    <Page>
      <Page.Header title="Default Wallet Settings" />
      <Page.Body>
        <ListItem
          title="Set OneKey as default wallet"
          subtitle="Use OneKey as the default wallet to connect to dApps."
        >
          <Switch
            size="small"
            value={result?.isDefaultWallet ?? true}
            onChange={async () => {
              await setIsDefaultWallet(!result?.isDefaultWallet);
              void run();
              setTimeout(() => {
                void refreshContextMenu();
              }, 200);
            }}
          />
        </ListItem>
        <Divider my="$2.5" />
        <ListItem
          title="Excluded dApps"
          subtitle="Right-click blank space, select the option below to exclude."
        />
        {renderList()}
      </Page.Body>
    </Page>
  );
}

export default DefaultWalletSettingsModal;
