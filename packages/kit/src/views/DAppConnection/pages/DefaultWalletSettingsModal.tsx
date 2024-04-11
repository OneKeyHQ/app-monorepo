import { useCallback, useEffect, useMemo, useRef } from 'react';

import { isNil } from 'lodash';

import {
  Divider,
  ESwitchSize,
  Image,
  ListView,
  Page,
  Skeleton,
  Stack,
  Switch,
  Toast,
} from '@onekeyhq/components';
import type { IDefaultWalletSettingsWithLogo } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityDefaultWalletSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
  const previousResultRef = useRef<IDefaultWalletSettingsWithLogo | null>(null);
  useEffect(() => {
    if (result) {
      previousResultRef.current = result;
    }
  }, [result]);
  useEffect(() => {
    appEventBus.addListener(EAppEventBusNames.ExtensionContextMenuUpdate, run);
    return () => {
      appEventBus.removeListener(
        EAppEventBusNames.ExtensionContextMenuUpdate,
        run,
      );
    };
  }, [run]);

  const setIsDefaultWallet = useCallback(async (val: boolean) => {
    await backgroundApiProxy.serviceContextMenu.setIsDefaultWallet(val);
  }, []);

  const getCurrentOrigin = useCallback(
    () =>
      new Promise<string>((resolve, reject) => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
            if (tabs[0]) {
              try {
                const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
                resolve(currentOrigin);
              } catch (e) {
                reject(e);
              }
            }
          },
        );
      }),
    [],
  );

  const refreshContextMenu = useCallback(
    async (origin?: string) => {
      if (!platformEnv.isExtension) return;
      if (!previousResultRef.current) return;

      const currentOrigin = await getCurrentOrigin();
      if (origin && origin !== currentOrigin) {
        return;
      }

      return backgroundApiProxy.serviceContextMenu.updateAndNotify({
        origin: currentOrigin,
        previousResult: previousResultRef.current,
      });
    },
    [getCurrentOrigin],
  );

  const onToggleDefaultWallet = useCallback(async () => {
    const isDefaultWallet = !result?.isDefaultWallet;
    await setIsDefaultWallet(isDefaultWallet);
    Toast.success({
      title: isDefaultWallet
        ? 'Default Changed to OneKey'
        : 'OneKey Default Canceled',
      message: isDefaultWallet
        ? 'OneKey is now your default wallet for this dApp.'
        : 'Refresh the page to retry with a different wallet.',
    });
    await refreshContextMenu();
    setTimeout(() => {
      void run();
    }, 200);
  }, [refreshContextMenu, result?.isDefaultWallet, run, setIsDefaultWallet]);

  const removeExcludedDApp = useCallback(
    async (origin: string) => {
      await backgroundApiProxy.serviceContextMenu.removeExcludedDApp(origin);
      if (result?.isDefaultWallet) {
        Toast.success({
          title: 'Default Changed to OneKey',
          message: 'OneKey is now your default wallet for this dApp.',
        });
      }
      await refreshContextMenu(origin);
      void run();
    },
    [run, result?.isDefaultWallet, refreshContextMenu],
  );

  const displayExcludedList = useMemo(() => {
    if (
      typeof result?.isDefaultWallet === 'boolean' &&
      !result.isDefaultWallet
    ) {
      return false;
    }
    return true;
  }, [result?.isDefaultWallet]);

  const renderItem = useCallback(
    ({ item }: { item: { origin: string; logo: string } }) => (
      <ListItem
        key={item.origin}
        title={item.origin}
        avatarProps={{
          src: item.logo,
          fallbackProps: {
            children: <Skeleton w="$10" h="$10" />,
          },
        }}
        onPress={() => removeExcludedDApp(item.origin)}
      >
        <ListItem.IconButton
          icon="DeleteOutline"
          iconProps={{
            color: '$iconSubdued',
          }}
        />
      </ListItem>
    ),
    [removeExcludedDApp],
  );

  const renderList = useCallback(() => {
    if (isNil(result?.excludedDappListWithLogo)) {
      return null;
    }
    if (result.excludedDappListWithLogo.length === 0) {
      return <EmptyGuide />;
    }
    return (
      <ListView
        keyExtractor={(item) => item.origin}
        data={result.excludedDappListWithLogo}
        estimatedItemSize="$10"
        renderItem={renderItem}
      />
    );
  }, [result?.excludedDappListWithLogo, renderItem]);

  return (
    <Page>
      <Page.Header title="Default Wallet Settings" />
      <Page.Body>
        <ListItem
          title="Set OneKey as default wallet"
          subtitle="Use OneKey as the default wallet to connect to dApps."
        >
          <Switch
            size={ESwitchSize.small}
            value={result?.isDefaultWallet ?? true}
            onChange={onToggleDefaultWallet}
          />
        </ListItem>
        {displayExcludedList ? (
          <>
            <Divider my="$2.5" />
            <ListItem
              title="Excluded dApps"
              subtitle="Right-click blank space, select the option below to exclude."
            />
            {renderList()}
          </>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default DefaultWalletSettingsModal;
