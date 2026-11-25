import { SizableText, Stack, XStack } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import type { IEarnDesktopLoanAsset } from './earnDesktopHome.utils';

const LOGOS_SHOWN = 4;

/**
 * A position's assets, overlapping, the first on top: what backs its loans,
 * or what it borrows. Each logo is ringed in the surface it sits on, so the
 * overlap reads as a cut rather than a border
 */
export function EarnLoanAssetLogos({
  assets,
  ringColor = '$bgApp',
}: {
  assets: IEarnDesktopLoanAsset[];
  ringColor?: ColorTokens;
}) {
  if (!assets.length) {
    return null;
  }
  const shown = assets.slice(0, LOGOS_SHOWN);
  return (
    <XStack ai="center">
      {shown.map((asset, index) => (
        <Stack
          key={asset.symbol}
          ml={index ? '$-1.5' : undefined}
          zIndex={shown.length - index}
          borderRadius="$full"
          borderWidth={2}
          borderColor={ringColor}
        >
          <Token size="xs" tokenImageUri={asset.logoURI} />
        </Stack>
      ))}
      {assets.length > LOGOS_SHOWN ? (
        <SizableText size="$bodySm" color="$textSubdued" ml="$1">
          {`+${assets.length - LOGOS_SHOWN}`}
        </SizableText>
      ) : null}
    </XStack>
  );
}
