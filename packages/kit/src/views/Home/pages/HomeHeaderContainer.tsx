import type { PropsWithChildren } from 'react';
import { memo, useCallback, useContext, useMemo, useState } from 'react';

import {
  CollapsibleTabContext,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { WALLET_TYPE_HD } from '@onekeyhq/shared/src/consts/dbConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { scrollTo, useSharedValue } from 'react-native-reanimated';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { HomeTokenListProviderMirror } from '../components/HomeTokenListProvider/HomeTokenListProviderMirror';
import ReferralCodeBlock from '../components/NotBakcedUp/ReferralCodeBlock';
import { ReceiveInfo } from '../components/ReceiveInfo';
import { WalletActions } from '../components/WalletActions';
import WalletBanner from '../components/WalletBanner';

import { HomeOverviewContainer } from './HomeOverviewContainer';

const HeaderScrollGestureWrapper = platformEnv.isNative
  ? ({ children }: PropsWithChildren) => {
      const tabsContext = useContext(CollapsibleTabContext);
      const refMap = tabsContext?.refMap;
      const focusedTab = tabsContext?.focusedTab;
      const scrollYCurrent = tabsContext?.scrollYCurrent;
      const contentInset = tabsContext?.contentInset ?? 0;

      const startScrollY = useSharedValue(0);

      const panGesture = useMemo(
        () =>
          Gesture.Pan()
            .activeOffsetY([-10, 10])
            .onStart(() => {
              'worklet';
              startScrollY.value = scrollYCurrent?.value ?? 0;
            })
            .onUpdate((e) => {
              'worklet';
              if (refMap && focusedTab) {
                const ref = refMap[focusedTab.value];
                if (ref) {
                  const nextY = startScrollY.value - e.translationY;
                  scrollTo(ref, 0, Math.max(0, nextY - contentInset), false);
                }
              }
            }),
        [startScrollY, scrollYCurrent, refMap, focusedTab, contentInset],
      );

      return (
        <GestureDetector gesture={panGesture}>
          <Animated.View>{children}</Animated.View>
        </GestureDetector>
      );
    }
  : ({ children }: PropsWithChildren) => <>{children}</>;

function BaseHomeHeaderContainer() {
  const {
    activeAccount: { wallet },
  } = useActiveAccount({
    num: 0,
  });

  const media = useMedia();

  const [showReceiveInfo, setShowReceiveInfo] = useState(false);
  const [showReferralCodeBlock, setShowReferralCodeBlock] = useState(false);

  const isWalletNotBackedUp = useMemo(() => {
    if (wallet && wallet.type === WALLET_TYPE_HD && !wallet.backuped) {
      return true;
    }
    return false;
  }, [wallet]);

  const shouldShowInitBlock =
    !isWalletNotBackedUp && (showReceiveInfo || showReferralCodeBlock);

  const renderWalletInitBlock = useCallback(() => {
    if (isWalletNotBackedUp) {
      return null;
    }

    if (platformEnv.isNative || media.gtMd) {
      return (
        <YStack
          display={shouldShowInitBlock ? 'flex' : 'none'}
          px="$pagePadding"
          gap="$5"
          $gtMd={{ flexDirection: 'row', gap: '$4' }}
          bg="$bgApp"
          pointerEvents="box-none"
        >
          <HeaderScrollGestureWrapper>
            <ReceiveInfo setShowReceiveInfo={setShowReceiveInfo} />
          </HeaderScrollGestureWrapper>
          <HeaderScrollGestureWrapper>
            <ReferralCodeBlock
              setShowReferralCodeBlock={setShowReferralCodeBlock}
            />
          </HeaderScrollGestureWrapper>
        </YStack>
      );
    }

    // Extension: always mount children so hooks run and report visibility.
    // Use height={0}+overflow="hidden" to hide individual blocks without unmounting.
    return (
      <YStack
        display={shouldShowInitBlock ? 'flex' : 'none'}
        $gtMd={{ flexDirection: 'row' }}
        px="$pagePadding"
        gap="$2"
        bg="$bgApp"
        pointerEvents="box-none"
      >
        <Stack
          height={showReceiveInfo ? 270 : 0}
          overflow={showReceiveInfo ? 'visible' : 'hidden'}
        >
          <ReceiveInfo setShowReceiveInfo={setShowReceiveInfo} />
        </Stack>
        <Stack
          height={showReferralCodeBlock ? 270 : 0}
          overflow={showReferralCodeBlock ? 'visible' : 'hidden'}
        >
          <ReferralCodeBlock
            setShowReferralCodeBlock={setShowReferralCodeBlock}
          />
        </Stack>
      </YStack>
    );
  }, [
    isWalletNotBackedUp,
    media.gtMd,
    shouldShowInitBlock,
    showReceiveInfo,
    showReferralCodeBlock,
  ]);

  return (
    <HomeTokenListProviderMirror>
      <YStack
        pb="$8"
        gap="$5"
        $gtMd={{ gap: '$8' }}
        bg="$bgApp"
        pointerEvents="box-none"
      >
        <Stack
          testID="Wallet-Tab-Header"
          gap="$5"
          pt="$5"
          $gtMd={{
            pt: '$8',
          }}
          px="$pagePadding"
          bg="$bgApp"
          pointerEvents="box-none"
        >
          <HeaderScrollGestureWrapper>
            <Stack gap="$2.5">
              <HomeOverviewContainer />
            </Stack>
          </HeaderScrollGestureWrapper>
          {isWalletNotBackedUp ? null : (
            <HeaderScrollGestureWrapper>
              <WalletActions />
            </HeaderScrollGestureWrapper>
          )}
        </Stack>
        {isWalletNotBackedUp ? null : <WalletBanner />}
        {renderWalletInitBlock()}
      </YStack>
    </HomeTokenListProviderMirror>
  );
}

export const HomeHeaderContainer = memo(BaseHomeHeaderContainer);
