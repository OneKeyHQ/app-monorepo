import { colord } from 'colord';
import { useWindowDimensions } from 'react-native';

import { LinearGradient, Stack, useTheme } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletPortfolioArtwork } from './WalletPortfolioArtwork';

export function WalletPortfolioIllustration() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const deviceWidth = Math.min(144, width - 80);
  const scale = deviceWidth / 230;
  const background = theme.bg.val;
  const illustrationHeight = 300 * scale;
  const fadeTop = 180 * scale;
  // Use a longer, eased dissolve so the device disappears before the crop edge.
  // Preserve Device Stage's Android clipping bleed.
  const fadeBleed = platformEnv.isNativeAndroid ? 2 : 0;
  const fadeRatio =
    (illustrationHeight - fadeTop) / (illustrationHeight - fadeTop + fadeBleed);

  return (
    <Stack
      testID="portfolio-spotlight-illustration"
      height={illustrationHeight}
      width="100%"
      alignItems="center"
      overflow="hidden"
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Stack
        width={deviceWidth}
        height={363 * scale}
        borderRadius={42 * scale}
        overflow="hidden"
      >
        <WalletPortfolioArtwork scale={scale} />
      </Stack>
      <LinearGradient
        testID="portfolio-illustration-fade"
        position="absolute"
        top={fadeTop}
        left={0}
        right={0}
        bottom={-fadeBleed}
        colors={[
          colord(background).alpha(0).toRgbString(),
          colord(background).alpha(0.025).toRgbString(),
          colord(background).alpha(0.13).toRgbString(),
          colord(background).alpha(0.35).toRgbString(),
          colord(background).alpha(0.64).toRgbString(),
          colord(background).alpha(0.86).toRgbString(),
          colord(background).alpha(0.975).toRgbString(),
          background,
        ]}
        locations={[
          0,
          0.18 * fadeRatio,
          0.36 * fadeRatio,
          0.54 * fadeRatio,
          0.7 * fadeRatio,
          0.84 * fadeRatio,
          0.96 * fadeRatio,
          fadeRatio,
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Stack>
  );
}
