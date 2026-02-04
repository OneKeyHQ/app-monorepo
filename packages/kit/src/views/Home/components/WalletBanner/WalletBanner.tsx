import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  runOnJS,
  scrollTo,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
// Access the collapsible-tab-view internal context for programmatic vertical scroll
import { Context as CollapsibleTabContext } from 'react-native-collapsible-tab-view/src/Context';

const BANNER_ITEM_WIDTH = 280;
const BANNER_GAP = 8;
const BANNER_PADDING_H = 20;

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
      w={BANNER_ITEM_WIDTH}
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

function NativeBannerScroller({
  banners,
  handleBannerOnPress,
  handleDismiss,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
}) {
  // Access collapsible-tab-view context to programmatically drive vertical scroll
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  // Suppress onPress when a drag gesture occurred
  const hasDraggedRef = useRef(false);
  const setHasDragged = useCallback((value: boolean) => {
    hasDraggedRef.current = value;
  }, []);

  const translateX = useSharedValue(0);
  const startTranslateX = useSharedValue(0);
  const startScrollY = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | undefined>(undefined);

  const [containerWidth, setContainerWidth] = useState(0);

  const actualMaxTranslateX = useMemo(() => {
    const totalWidth =
      banners.length * BANNER_ITEM_WIDTH +
      (banners.length - 1) * BANNER_GAP +
      BANNER_PADDING_H * 2;
    const width = containerWidth || 375;
    return Math.max(0, totalWidth - width);
  }, [banners.length, containerWidth]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          runOnJS(setHasDragged)(false);
        })
        .onStart(() => {
          'worklet';
          startTranslateX.value = translateX.value;
          startScrollY.value = scrollYCurrent?.value ?? 0;
          isHorizontal.value = undefined;
        })
        .onUpdate((e) => {
          'worklet';
          // Determine direction on first significant movement
          if (isHorizontal.value === undefined) {
            if (
              Math.abs(e.translationX) > 5 ||
              Math.abs(e.translationY) > 5
            ) {
              isHorizontal.value =
                Math.abs(e.translationX) > Math.abs(e.translationY);
              runOnJS(setHasDragged)(true);
            }
            return;
          }

          if (isHorizontal.value) {
            // Horizontal: drive banner translateX
            translateX.value = clamp(
              startTranslateX.value + e.translationX,
              -actualMaxTranslateX,
              0,
            );
          } else if (refMap && focusedTab) {
            // Vertical: programmatically scroll the underlying tab ScrollView
            const ref = refMap[focusedTab.value];
            if (ref) {
              const nextY = startScrollY.value - e.translationY;
              scrollTo(ref, 0, Math.max(0, nextY) - contentInset, false);
            }
          }
        })
        .onEnd((e) => {
          'worklet';
          if (isHorizontal.value) {
            translateX.value = withDecay({
              velocity: e.velocityX,
              clamp: [-actualMaxTranslateX, 0],
            });
          }
        }),
    [
      translateX,
      startTranslateX,
      startScrollY,
      isHorizontal,
      actualMaxTranslateX,
      refMap,
      focusedTab,
      scrollYCurrent,
      contentInset,
      setHasDragged,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const wrappedHandleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (hasDraggedRef.current) {
        return;
      }
      handleBannerOnPress(item);
    },
    [handleBannerOnPress],
  );

  return (
    <YStack
      py="$2.5"
      bg="$bgApp"
      overflow="hidden"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              paddingHorizontal: BANNER_PADDING_H,
              gap: BANNER_GAP,
            },
            animatedStyle,
          ]}
        >
          {banners.map((item) => (
            <BannerItem
              key={item.id}
              item={item}
              onPress={wrappedHandleBannerOnPress}
              onDismiss={handleDismiss}
            />
          ))}
        </Animated.View>
      </GestureDetector>
    </YStack>
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

  if (platformEnv.isNative) {
    return (
      <NativeBannerScroller
        banners={banners}
        handleBannerOnPress={handleBannerOnPress}
        handleDismiss={handleDismiss}
      />
    );
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
