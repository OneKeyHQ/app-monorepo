import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Divider,
  Icon,
  ListView,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { DeviceCommonHeader } from '../DeviceCommonHeader';
import { DeviceGuideView } from '../DeviceGuideModal/DeviceGuideView';

import SectionHeader from './SectionHeader';
import { VerifiedBadge } from './VerifiedBadge';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

export type IDeviceManagementListItem = IHwQrWalletWithDevice & {
  firmwareTypeBadge?: EFirmwareType;
  firmwareVersionDisplay?: string;
  bleName?: string;
  shouldUpdate?: boolean;
  updateVersionDisplay?: string;
};

function DeviceListItem({
  item,
  onPress,
}: {
  item: IDeviceManagementListItem;
  onPress: (wallet: IHwQrWalletWithDevice['wallet']) => void;
}) {
  const { gtMd } = useMedia();
  const walletAvatarProps: IWalletAvatarProps = {
    img: item.wallet.avatarInfo?.img,
    wallet: item.wallet,
    firmwareTypeBadge: item.firmwareTypeBadge,
    firmwareTypeProps: {
      top: 0,
      left: -1,
    },
  };

  const isVerified = Boolean(item.device?.verifiedAtVersion);

  const bleName = deviceUtils.buildDeviceBleName({
    features: item.device?.featuresInfo,
  });

  const renderItemText = useMemo(() => {
    if (item.shouldUpdate) {
      if (gtMd) {
        return (
          <Badge badgeSize="sm" badgeType="info">
            <XStack ai="center" gap="$1.5">
              <Icon name="DownloadCircleOutline" color="$iconInfo" size="$4" />
              <SizableText size="$bodySmMedium" color="$textInfo">
                {item.updateVersionDisplay}
              </SizableText>
            </XStack>
          </Badge>
        );
      }
      return (
        <Stack width="$1" height="$1" bg="$iconInfo" borderRadius="$full" />
      );
    }

    if (gtMd) {
      return (
        <SizableText size="$bodyMd" color="$textDisabled">
          {item.firmwareVersionDisplay}
        </SizableText>
      );
    }

    return null;
  }, [
    gtMd,
    item.shouldUpdate,
    item.updateVersionDisplay,
    item.firmwareVersionDisplay,
  ]);

  return (
    <ListItem
      mx="$0"
      px="$4"
      minHeight={88}
      borderRadius="$0"
      renderAvatar={() => (
        <Stack
          w={56}
          h={56}
          justifyContent="center"
          alignItems="center"
          borderRadius="$3"
          bg="$bgStrong"
        >
          <WalletAvatar {...walletAvatarProps} size={48} />
        </Stack>
      )}
      renderItemText={() => (
        <YStack gap="$1" flex={1}>
          <XStack gap="$2">
            <SizableText size="$bodyLgMedium" color="$text" numberOfLines={1}>
              {item.wallet.name}
            </SizableText>
            {bleName ? (
              <Badge badgeSize="sm" badgeType="default">
                {bleName}
              </Badge>
            ) : null}
          </XStack>
          <VerifiedBadge isVerified={isVerified} />
        </YStack>
      )}
      onPress={() => onPress(item.wallet)}
      drillIn
    >
      {renderItemText}
    </ListItem>
  );
}

const ItemSeparatorComponent = () => <Divider borderColor="$borderSubdued" />;

const ListEmptyComponent = () => (
  <Stack p="$16">
    <Spinner size="large" />
  </Stack>
);

function DeviceManagementV2ListWeb() {
  const intl = useIntl();
  const { pushToDeviceDetail } = useDeviceManagerNavigation();

  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();

  const {
    result: hwQrWalletList = [],
    run: refreshHwQrWalletList,
    isLoading,
  } = usePromiseResult<Array<IDeviceManagementListItem>>(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
          skipDuplicateDevice: true,
        });
      const devices: Array<IDeviceManagementListItem> = Object.values(r)
        .filter(
          (item): item is IHwQrWalletWithDevice =>
            Boolean(item.device) && !item.wallet.deprecated,
        )
        .sort((a, b) => {
          const orderA = a.wallet.walletOrder || a.wallet.walletNo;
          const orderB = b.wallet.walletOrder || b.wallet.walletNo;
          return orderA - orderB;
        });

      for (const item of devices) {
        const firmwareTypeBadge = await deviceUtils.getFirmwareType({
          features: item.device?.featuresInfo,
        });
        const deviceVersion = await deviceUtils.getDeviceVersion({
          device: item.device,
          features: item.device?.featuresInfo,
        });
        const deviceDetectStatus = detectStatus?.[item.device?.connectId ?? ''];
        const shouldUpdate = deviceDetectStatus?.hasUpgrade;
        const updateVersionDisplay = deviceDetectStatus?.toVersion;

        item.firmwareTypeBadge = firmwareTypeBadge;
        item.firmwareVersionDisplay = `v${
          deviceVersion.firmwareVersion ?? '-'
        }`;
        item.shouldUpdate = shouldUpdate;
        item.updateVersionDisplay = `v${updateVersionDisplay ?? '-'}`;
      }
      return devices;
    },
    [detectStatus],
    {
      checkIsFocused: false,
      initResult: [],
      watchLoading: true,
    },
  );

  useEffect(() => {
    const fn = () => {
      void refreshHwQrWalletList();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [refreshHwQrWalletList]);

  const onWalletPressed = useCallback(
    (wallet: IHwQrWalletWithDevice['wallet']) => {
      if (wallet.id) {
        pushToDeviceDetail({
          walletId: wallet.id,
        });
      }
    },
    [pushToDeviceDetail],
  );

  const renderItem = useCallback(
    ({ item }: { item: IDeviceManagementListItem }) => (
      <DeviceListItem
        key={item.wallet.id}
        item={item}
        onPress={onWalletPressed}
      />
    ),
    [onWalletPressed],
  );

  const existingDevices = useMemo(() => {
    return hwQrWalletList.length > 0;
  }, [hwQrWalletList]);

  return (
    <Page fullPage>
      <DeviceCommonHeader
        title={intl.formatMessage({
          id: ETranslations.global_device_management,
        })}
      />
      <Page.Body alignItems="stretch" h="100%">
        {existingDevices || isLoading ? (
          <YStack
            w="100%"
            h="100%"
            maxWidth="640px"
            mx="auto"
            px="$5"
            py="$8"
            gap="$6"
            bg="$bgApp"
          >
            <SectionHeader />
            <ListView
              flex={1}
              contentContainerStyle={{
                paddingTop: 0,
                borderRadius: '$4',
                bg: '$bgApp',
                borderColor: '$borderSubdued',
                overflow: 'hidden',
                borderWidth: '$px',
              }}
              keyExtractor={(item) => item.wallet.id}
              data={hwQrWalletList}
              renderItem={renderItem}
              estimatedItemSize={88}
              ListEmptyComponent={ListEmptyComponent}
              ItemSeparatorComponent={ItemSeparatorComponent}
            />
          </YStack>
        ) : null}
        {!existingDevices && !isLoading ? <DeviceGuideView /> : null}
      </Page.Body>
    </Page>
  );
}

function DeviceManagementListPageContainer() {
  const sceneName = EAccountSelectorSceneName.home;
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <DeviceManagementV2ListWeb />
    </AccountSelectorProviderMirror>
  );
}

export default DeviceManagementListPageContainer;
