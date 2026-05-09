import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { Token, TokenGroup } from '@onekeyhq/kit/src/components/Token';
import type { IProtocolUnifiedPositionDisplay } from '@onekeyhq/kit/src/utils/defiPositionUtils';

// ProtocolPositionCell renders the leftmost cell of the unified protocol
// table. The display shape is decided upstream by the category builder: LP
// uses overlapping avatars, deposit uses a single token icon, everything
// else falls back to the pool name as plain text.

type IProtocolPositionCellProps = {
  display: IProtocolUnifiedPositionDisplay;
};

const ProtocolPositionCell = memo(({ display }: IProtocolPositionCellProps) => {
  if (display.kind === 'lp-stack') {
    return (
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        {display.tokens.length ? (
          <TokenGroup
            tokens={display.tokens.map((token) => ({
              tokenImageUri: token.logoUrl,
            }))}
            size="xs"
            variant="overlapped"
            wrapperStyle="border"
            wrapperBorderColor="$bgApp"
          />
        ) : null}
        <SizableText size="$bodyLg" color="$text" flex={1} minWidth={0}>
          {display.text}
        </SizableText>
      </XStack>
    );
  }

  if (display.kind === 'icon-text') {
    return (
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        {display.iconUrl ? (
          <Token size="xs" tokenImageUri={display.iconUrl} bg="$bgStrong" />
        ) : null}
        <SizableText size="$bodyLg" color="$text" flex={1} minWidth={0}>
          {display.text}
        </SizableText>
      </XStack>
    );
  }

  return (
    <SizableText size="$bodyLg" color="$text" flex={1} minWidth={0}>
      {display.text}
    </SizableText>
  );
});

ProtocolPositionCell.displayName = 'ProtocolPositionCell';

export { ProtocolPositionCell };
