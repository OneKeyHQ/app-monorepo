import { useMemo } from 'react';

import type { IXStackProps } from '@onekeyhq/components';
import { Badge, Stack, XStack } from '@onekeyhq/components';

import { Token } from './Token';

import type { ITokenProps } from './Token';

export type ITokenGroupItem = {
  tokenImageUri?: string;
};

type ITokenSize = ITokenProps['size'];

export type ITokenGroupProps = {
  /** Token list to display */
  tokens: ITokenGroupItem[];
  /** Token size, matches ITokenSize from Token component */
  size?: ITokenSize;
  /** Display variant: overlapped (stacked) or spread (inline with gap) */
  variant?: 'overlapped' | 'spread';
  /** Maximum number of visible tokens */
  maxVisible?: number;
  /**
   * Overlap offset for overlapped variant
   * Uses Tamagui space tokens like '$-2', '$-3', '$-4' or number values
   */
  overlapOffset?: string | number;
  /**
   * Wrapper style for overlapped tokens
   * - 'background': Uses background color with padding (like NetworkAvatarGroup)
   * - 'border': Uses borderWidth with borderColor
   * - 'none': No wrapper styling
   */
  wrapperStyle?: 'background' | 'border' | 'none';
  /** Background color for 'background' wrapperStyle */
  backgroundColor?: string;
  /** Border color for 'border' wrapperStyle */
  wrapperBorderColor?: string;
  /** Whether to show remaining count badge when tokens exceed maxVisible */
  showRemainingBadge?: boolean;
} & Omit<IXStackProps, 'children'>;

// Default overlap offsets based on token size
const defaultOverlapOffsets: Record<NonNullable<ITokenSize>, string> = {
  xl: '$-5',
  lg: '$-4',
  md: '$-3.5',
  sm: '$-3',
  xs: '$-2.5',
};

function getWrapperProps(
  wrapperStyle: 'background' | 'border' | 'none',
  backgroundColor: string,
  wrapperBorderColor: string,
  index: number,
  offset: string | number,
) {
  const baseProps: Record<string, unknown> = {
    borderRadius: '$full',
    ...(index !== 0 && { ml: offset }),
  };

  switch (wrapperStyle) {
    case 'background':
      return {
        ...baseProps,
        p: '$0.5',
        bg: backgroundColor,
      };
    case 'border':
      return {
        ...baseProps,
        borderWidth: 2,
        borderColor: wrapperBorderColor,
      };
    case 'none':
    default:
      return baseProps;
  }
}

export function TokenGroup({
  tokens,
  size = 'sm',
  variant = 'overlapped',
  maxVisible = 3,
  overlapOffset,
  wrapperStyle = 'background',
  backgroundColor = '$bgApp',
  wrapperBorderColor = '$bgApp',
  showRemainingBadge = true,
  ...rest
}: ITokenGroupProps) {
  const visibleTokens = useMemo(() => {
    if (!tokens || !tokens.length) return [];
    if (tokens.length > maxVisible) {
      return tokens.slice(0, maxVisible);
    }
    return tokens;
  }, [tokens, maxVisible]);

  const remainingCount = tokens ? tokens.length - visibleTokens.length : 0;

  if (!tokens || !tokens.length) return null;

  // Calculate effective overlap offset
  const effectiveOffset =
    overlapOffset || defaultOverlapOffsets[size || 'sm'] || '$-3';

  if (variant === 'overlapped') {
    return (
      <XStack {...rest}>
        {visibleTokens.map((token, index) => {
          const wrapperProps = getWrapperProps(
            wrapperStyle,
            backgroundColor,
            wrapperBorderColor,
            index,
            effectiveOffset,
          );
          return (
            <Stack key={token.tokenImageUri || index} {...wrapperProps}>
              <Token size={size} tokenImageUri={token.tokenImageUri} />
            </Stack>
          );
        })}
        {remainingCount > 0 && showRemainingBadge ? (
          <Stack
            p="$0.5"
            borderRadius="$full"
            bg={backgroundColor}
            ml={effectiveOffset}
          >
            <Badge badgeType="default" badgeSize="sm">
              <Badge.Text>+{remainingCount}</Badge.Text>
            </Badge>
          </Stack>
        ) : null}
      </XStack>
    );
  }

  // Spread variant
  return (
    <XStack ai="center" gap="$1" {...rest}>
      {visibleTokens.map((token, index) => (
        <Token
          key={token.tokenImageUri || index}
          size={size}
          tokenImageUri={token.tokenImageUri}
        />
      ))}
      {remainingCount > 0 && showRemainingBadge ? (
        <Badge badgeType="default" badgeSize="sm">
          <Badge.Text>+{remainingCount}</Badge.Text>
        </Badge>
      ) : null}
    </XStack>
  );
}
