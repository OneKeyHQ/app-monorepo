import { useEffect } from 'react';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  EParseTxComponentType,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import SignGuardIcon from '../SimilarAddressDialog/SignGuardIcon';

import { Assets } from './Assets';
import { LaserBorder } from './LaserBorder';

const BORDER_RADIUS = 12;
const ICON_WIDTH = 80;
const SHIMMER_BAND = 24;

type IProps = {
  component: IDisplayComponentSimulation;
};

function ShimmerSignGuard() {
  const translate = useSharedValue(-SHIMMER_BAND);
  const END = ICON_WIDTH + SHIMMER_BAND;
  const START = -SHIMMER_BAND;
  const FAST = 350;
  const SLOW = 1500;

  useEffect(() => {
    const sweep = (v: number, d: number) =>
      withTiming(v, { duration: d, easing: Easing.inOut(Easing.sin) });
    const reset = (v: number) => withTiming(v, { duration: 0 });

    translate.value = withDelay(
      1200,
      withSequence(
        sweep(END, FAST),
        reset(START),
        sweep(END, FAST),
        reset(START),
        withDelay(200, sweep(END, SLOW)),
      ),
    );
  }, [translate, END, START, FAST, SLOW]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translate.value }],
  }));

  return (
    <Stack style={{ width: ICON_WIDTH, height: 14, overflow: 'hidden' }}>
      <SignGuardIcon width={ICON_WIDTH} height={14} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: SHIMMER_BAND,
          },
          shimmerStyle,
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </Stack>
  );
}

function Simulation(props: IProps) {
  const { component } = props;

  return (
    <LaserBorder borderRadius={BORDER_RADIUS}>
      <YStack px="$4" py="$3" gap={6}>
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$headingXs" color="$textSubdued">
            {component.label}
          </SizableText>
          <ShimmerSignGuard />
        </XStack>
        <YStack gap="$3">
          {component.assets.map((asset, index) => {
            if (asset.type === EParseTxComponentType.NFT) {
              return (
                // oxlint-disable-next-line react/jsx-pascal-case -- NFT is an acronym
                <Assets.NFT
                  hideLabel
                  inSimulation
                  key={index}
                  component={asset}
                  networkId={asset.networkId}
                  showNetwork={asset.showNetwork}
                />
              );
            }
            if (asset.type === EParseTxComponentType.Token) {
              return (
                <Assets.Token
                  hideLabel
                  inSimulation
                  key={index}
                  component={asset}
                  showNetwork={asset.showNetwork}
                  networkId={asset.networkId}
                />
              );
            }
            return null;
          })}
        </YStack>
      </YStack>
    </LaserBorder>
  );
}

export { Simulation };
