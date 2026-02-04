import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';

import {
  Icon,
  IconButton,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import {
  useAccountOverviewActions,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import type { GestureResponderEvent } from 'react-native';
import { ENotificationPushMessageMode } from '@onekeyhq/shared/types/notification';

const closedBanners: Record<string, boolean> = {};

const staticBanners: IWalletBanner[] = [
  {
    _id: 'static-1',
    id: 'static-1',
    src: '',
    title: 'Use USDT to cover fees',
    description: '',
    button: '',
    rank: 0,
    closeable: false,
    closeForever: false,
    useSystemBrowser: false,
    theme: 'light',
    icon: {
      name: 'GasSolid',
    },
    mode: ENotificationPushMessageMode.openInDapp,
    payload: 'https://onekey.so',
  },
  {
    _id: 'static-2',
    id: 'static-2',
    src: '',
    title: 'Invite friends and get rewards',
    description: '',
    button: '',
    rank: 0,
    closeable: false,
    closeForever: false,
    useSystemBrowser: false,
    theme: 'light',
    icon: {
      name: 'GiftSolid',
    },
    mode: ENotificationPushMessageMode.openInDapp,
    payload: 'https://onekey.so',
  },
  {
    _id: 'static-3',
    id: 'static-3',
    src: '',
    title: 'Sign & verify message',
    description: '',
    button: '',
    rank: 0,
    closeable: false,
    closeForever: false,
    useSystemBrowser: false,
    theme: 'light',
    icon: {
      name: 'PenSolid',
    },
    mode: ENotificationPushMessageMode.openInDapp,
    payload: 'https://onekey.so',
  },
];

function BannerItem({
  item,
  onPress,
  onDismiss,
}: {
  item: IWalletBanner;
  onPress: (item: IWalletBanner) => void;
  onDismiss: (item: IWalletBanner) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);
  return (
    <XStack
      w={280}
      h={108}
      p="$1"
      bg="$bgSubdued"
      borderRadius="$4"
      borderCurve="continuous"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      onPress={handlePress}
    >
      <XStack ai="center">
        {item.src ? (
          <Image size={60} mx="$2.5" source={{ uri: item.src }} />
        ) : null}
        {item.title && item.description ? (
          <YStack flex={1} gap="$2" ml={!item.src ? '$4' : undefined}>
            <SizableText size="$bodyXs" color="$text" numberOfLines={1} w={184}>
              {item.title}
            </SizableText>
            {item.description ? (
              <SizableText
                w={184}
                fontWeight={600}
                fontSize={14}
                numberOfLines={2}
              >
                {item.description}
              </SizableText>
            ) : null}
          </YStack>
        ) : null}
        {item.title && !item.description ? (
          <SizableText
            w={184}
            left="$4"
            top="$4"
            position="absolute"
            fontWeight={600}
            fontSize={14}
            numberOfLines={2}
          >
            {item.title}
          </SizableText>
        ) : null}
      </XStack>

      {item.closeable ? (
        <IconButton
          position="absolute"
          top="$2"
          right="$2"
          size="small"
          variant="tertiary"
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onDismiss(item);
          }}
          icon="CrossedSmallOutline"
        />
      ) : null}
      {item.icon ? (
        <Stack position="absolute" right="$4" bottom="$4">
          <Icon
            name={item.icon.name}
            size={item.icon.size || 24}
            style={{ color: item.icon.color || '#32B826' }}
          />
        </Stack>
      ) : null}
    </XStack>
  );
}

function WalletBanner() {
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });

  const closedBannerInitRef = useRef(false);

  const bannersInitRef = useRef(false);

  const [{ banners: remoteBanners }] = useWalletTopBannersAtom();
  const banners = useMemo(
    () => [...remoteBanners, ...staticBanners],
    [remoteBanners],
  );
  const { updateWalletTopBanners } = useAccountOverviewActions().current;

  const { handleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });

  const [closedForeverBanners, setClosedForeverBanners] = useState<
    Record<string, boolean>
  >({});

  const { result: latestBanners } = usePromiseResult(
    async () => {
      if (isNil(account?.id)) {
        return [];
      }
      const resp =
        await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
          accountId: account.id,
        });
      bannersInitRef.current = true;
      return resp;
    },
    [account?.id],
    {
      initResult: [],
    },
  );

  usePromiseResult(async () => {
    if (!closedBannerInitRef.current || !bannersInitRef.current) return;

    const filteredBanners = latestBanners.filter((banner) => {
      if (banner.position && banner.position !== 'home') {
        return false;
      }
      return !closedForeverBanners[banner.id];
    });
    updateWalletTopBanners({
      banners: filteredBanners,
    });
    await backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
      topBanners: filteredBanners,
    });
  }, [latestBanners, closedForeverBanners, updateWalletTopBanners]);

  const handleDismiss = useCallback(async (item: IWalletBanner) => {
    if (item.closeable) {
      closedBanners[item.id] = true;
      setClosedForeverBanners((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'close',
      });
      if (item.closeForever) {
        await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
          {
            bannerId: item.id,
            closedForever: true,
          },
        );
      }
    }
  }, []);

  const initLocalBanners = useCallback(async () => {
    const walletBannerRawData =
      await backgroundApiProxy.simpleDb.walletBanner.getRawData();
    const localTopBanners = walletBannerRawData?.topBanners ?? [];
    const localClosedForeverBanners = walletBannerRawData?.closedForever ?? {};
    updateWalletTopBanners({
      banners: localTopBanners,
    });
    closedBannerInitRef.current = true;
    setClosedForeverBanners({
      ...closedBanners,
      ...localClosedForeverBanners,
    });
  }, [updateWalletTopBanners, setClosedForeverBanners]);

  useEffect(() => {
    void initLocalBanners();
  }, [initLocalBanners]);

  if (banners.length === 0) {
    return null;
  }

  return (
    <YStack py="$2.5" bg="$bgApp">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          gap: 8,
        }}
      >
        {banners.map((item) => (
          <BannerItem
            key={item.id}
            item={item}
            onPress={handleBannerOnPress}
            onDismiss={handleDismiss}
          />
        ))}
      </ScrollView>
    </YStack>
  );
}

export default WalletBanner;
