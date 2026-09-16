import { Divider, Image, SizableText, XStack } from '@onekeyhq/components';
import type { IMarketTokenLaunchpad } from '@onekeyhq/shared/types/marketV2';

import { resolveLaunchpadDisplay } from '../../utils/resolveLaunchpadDisplay';

export function TokenLaunchpad({
  launchpad,
  showLeadingDivider = false,
}: {
  launchpad: IMarketTokenLaunchpad | null | undefined;
  showLeadingDivider?: boolean;
}) {
  const display = resolveLaunchpadDisplay(launchpad);

  if (!display) {
    return null;
  }

  return (
    <>
      {showLeadingDivider ? (
        <Divider vertical backgroundColor="$borderSubdued" h="$3" />
      ) : null}
      <XStack
        testID="market-detail-launchpad"
        ai="center"
        gap="$1"
        cursor="default"
      >
        <Image
          width={16}
          height={16}
          borderRadius="$full"
          source={{ uri: display.logoUrl }}
        />
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {display.name}
        </SizableText>
      </XStack>
    </>
  );
}
