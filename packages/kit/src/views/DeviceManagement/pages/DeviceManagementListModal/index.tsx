import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Anchor,
  Icon,
  ListView,
  Page,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { HwWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

function DeviceManagementListModal() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const { result: deviceList = [], run: refreshDeviceList } =
    usePromiseResult(async () => {
      const { devices } =
        await backgroundApiProxy.serviceAccount.getAllActiveDevices();
      return devices;
    }, []);

  useEffect(() => {
    const fn = () => {
      void refreshDeviceList();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [refreshDeviceList]);

  const onAddDevice = useCallback(async () => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [appNavigation]);

  const renderItem = useCallback(
    ({ item }: { item: IDBDevice }) => (
      <ListItem
        title={item.name}
        drillIn
        avatarProps={{
          src: HwWalletAvatarImages[item.deviceType] as string,
        }}
        onPress={() => {
          console.log('device pressed:', item);
        }}
      />
    ),
    [],
  );

  const footer = useMemo(
    () => (
      <ListItem
        renderAvatar={() => (
          <XStack
            w="$10"
            h="$10"
            jc="center"
            ai="center"
            borderRadius="$2"
            bg="$bgStrong"
          >
            <Icon name="PlusSmallOutline" />
          </XStack>
        )}
        title={intl.formatMessage({
          id: ETranslations.global_add_new_device,
        })}
        drillIn
        onPress={onAddDevice}
      />
    ),
    [intl, onAddDevice],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_device_management,
        })}
      />
      <Page.Body pb="$9">
        <ListView
          data={deviceList}
          renderItem={renderItem}
          estimatedItemSize={68}
          ListFooterComponent={footer}
        />
        <XStack
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="$9"
          px="$5"
          justifyContent="center"
          alignItems="center"
          bg="$bg"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.global_onekey_prompt_dont_have_yet,
            })}
          </SizableText>
          <Anchor
            display="flex"
            color="$textInteractive"
            hoverStyle={{
              color: '$textInteractiveHover',
            }}
            href="https://bit.ly/3YsKilK"
            target="_blank"
            size="$bodyMdMedium"
            p="$2"
          >
            {intl.formatMessage({ id: ETranslations.global_buy_one })}
          </Anchor>
        </XStack>
      </Page.Body>
    </Page>
  );
}

export default DeviceManagementListModal;
