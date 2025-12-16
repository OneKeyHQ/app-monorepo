import type { IXStackProps, SizeTokens } from '@onekeyhq/components';
import { Skeleton, Stack, XStack } from '@onekeyhq/components';

type ITokenSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

export type ITokenGroupSkeletonProps = {
  /** Token size */
  size?: ITokenSize;
  /** Number of skeleton tokens to display */
  count?: number;
  /** Overlap offset for overlapped variant */
  overlapOffset?: string;
  /**
   * Wrapper style for overlapped tokens
   * - 'background': Uses background color with padding
   * - 'border': Uses borderWidth with borderColor
   * - 'none': No wrapper styling
   */
  wrapperStyle?: 'background' | 'border' | 'none';
  /** Background color for 'background' wrapperStyle */
  backgroundColor?: string;
  /** Border color for 'border' wrapperStyle */
  wrapperBorderColor?: string;
} & Omit<IXStackProps, 'children'>;

// Token size to image size mapping (from Token.tsx)
const tokenSizeMap: Record<ITokenSize, SizeTokens> = {
  xl: '$12',
  lg: '$10',
  md: '$8',
  sm: '$6',
  xs: '$5',
};

// Default overlap offsets based on token size (from TokenGroup.tsx)
const defaultOverlapOffsets: Record<ITokenSize, string> = {
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
  offset: string,
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

export function TokenGroupSkeleton({
  size = 'sm',
  count = 3,
  overlapOffset,
  wrapperStyle = 'background',
  backgroundColor = '$bgApp',
  wrapperBorderColor = '$bgApp',
  ...rest
}: ITokenGroupSkeletonProps) {
  const tokenImageSize = tokenSizeMap[size];
  const effectiveOffset = overlapOffset || defaultOverlapOffsets[size];

  return (
    <XStack {...rest}>
      {Array.from({ length: count }).map((_, index) => {
        const wrapperProps = getWrapperProps(
          wrapperStyle,
          backgroundColor,
          wrapperBorderColor,
          index,
          effectiveOffset,
        );
        return (
          <Stack key={index} {...wrapperProps}>
            <Skeleton w={tokenImageSize} h={tokenImageSize} radius="round" />
          </Stack>
        );
      })}
    </XStack>
  );
}
