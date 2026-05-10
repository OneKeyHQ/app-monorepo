import { memo } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';
import { Token, TokenGroup } from '@onekeyhq/kit/src/components/Token';

// ProtocolPositionCell renders the leftmost cell of every protocol table —
// LP, stake, deposit, lending, yield. The visual contract is "asset
// avatars on the left, position name on the right", regardless of how
// many assets the position holds. Multi-asset positions overlap their
// avatars (TokenGroup) and surface a "+N" overflow chip past the visible
// cap so an 8-token yield position doesn't paint eight separate icons.
//
// `name` is decided upstream by the category builder: LP joins the
// constituent symbols ("ETH + USDC"), everything else prefers the
// poolName and falls back to the same symbol-join when poolName is
// missing. The cell takes the resolved string verbatim and never tries
// to derive a label itself — keeps the formatting decision in one place.

const MAX_VISIBLE_AVATARS = 3;

type IProtocolPositionAsset = {
  logoUrl?: string;
};

type IProtocolPositionCellProps = {
  name: string;
  assets: IProtocolPositionAsset[];
};

const ProtocolPositionCell = memo(
  ({ name, assets }: IProtocolPositionCellProps) => {
    const visibleAvatars = assets.slice(0, MAX_VISIBLE_AVATARS);
    const overflowCount = Math.max(0, assets.length - MAX_VISIBLE_AVATARS);
    const hasAvatars = visibleAvatars.length > 0;

    // alignItems="flex-start" so when a long name wraps, the avatar
    // stays anchored to the first text line instead of vertically
    // re-centering on the whole multi-line block. Single-line names
    // visually look fine because $bodyMd's line-height ≈ xs Token's
    // height.
    return (
      <XStack alignItems="flex-start" gap="$2" minWidth={0} flex={1}>
        {hasAvatars ? (
          <XStack alignItems="center" gap="$1" flexShrink={0}>
            {visibleAvatars.length === 1 ? (
              <Token
                size="xs"
                tokenImageUri={visibleAvatars[0].logoUrl}
                bg="$bgStrong"
              />
            ) : (
              <TokenGroup
                tokens={visibleAvatars.map((asset) => ({
                  tokenImageUri: asset.logoUrl,
                }))}
                size="xs"
                variant="overlapped"
                wrapperStyle="border"
                wrapperBorderColor="$bgApp"
              />
            )}
            {overflowCount > 0 ? (
              <SizableText size="$bodySmMedium" color="$textSubdued">
                +{overflowCount}
              </SizableText>
            ) : null}
          </XStack>
        ) : null}
        {/* numberOfLines=2 caps runaway names while keeping the
            information-rich tail visible — single-line ellipsis would
            collapse "Curve fraxBP-USDC LP" and "Curve fraxBP-USDT LP"
            into the same display. */}
        <SizableText
          size="$bodyMd"
          color="$text"
          numberOfLines={2}
          flex={1}
          minWidth={0}
        >
          {name}
        </SizableText>
      </XStack>
    );
  },
);

ProtocolPositionCell.displayName = 'ProtocolPositionCell';

export { ProtocolPositionCell };
export type { IProtocolPositionAsset, IProtocolPositionCellProps };
