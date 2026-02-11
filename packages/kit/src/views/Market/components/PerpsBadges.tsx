import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

const LeverageBadge = memo(({ leverage }: { leverage: number }) => (
  <XStack
    borderRadius="$1"
    bg="$bgInfo"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textInfo" lineHeight={16}>
      {leverage}x
    </SizableText>
  </XStack>
));
LeverageBadge.displayName = 'LeverageBadge';

const SubtitleBadge = memo(({ subtitle }: { subtitle: string }) => (
  <XStack
    borderRadius="$1"
    bg="$bgStrong"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textSubdued" lineHeight={16}>
      {subtitle}
    </SizableText>
  </XStack>
));
SubtitleBadge.displayName = 'SubtitleBadge';

export { LeverageBadge, SubtitleBadge };
