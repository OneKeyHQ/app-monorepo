import type { ReactNode } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';

export function DetailsSectionContainer({
  title,
  titleAfter,
  children,
  showDivider = true,
  titleTextProps,
}: {
  title: string;
  titleAfter?: ReactNode;
  children: ReactNode;
  showDivider?: boolean;
  titleTextProps?: ISizableTextProps;
}) {
  return (
    <YStack gap="$6">
      <XStack ai="center" gap="$3" flexWrap="wrap">
        <EarnText
          text={{ text: title }}
          size="$bodyLgMedium"
          color="$textSubdued"
          {...titleTextProps}
        />
        {titleAfter ? (
          <XStack ai="center" gap="$2">
            {titleAfter}
          </XStack>
        ) : null}
      </XStack>
      {children}
      {showDivider ? <Divider /> : null}
    </YStack>
  );
}
