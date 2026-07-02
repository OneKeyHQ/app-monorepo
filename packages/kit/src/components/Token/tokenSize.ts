import type { SizeTokens } from '@onekeyhq/components';
import { s } from '@onekeyhq/components/src/utils/scale';

export type ITokenSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | 'xxs';

export const TOKEN_SIZE_MAP: Record<
  ITokenSize,
  {
    tokenImageSize: SizeTokens;
    chainImageSize: SizeTokens;
    fallbackIconSize: SizeTokens;
    tokenImageResizeWidth: number;
  }
> = {
  xl: {
    tokenImageSize: '$12',
    chainImageSize: '$5',
    fallbackIconSize: '$8',
    tokenImageResizeWidth: s(48),
  },
  lg: {
    tokenImageSize: '$10',
    chainImageSize: '$4',
    fallbackIconSize: '$7',
    tokenImageResizeWidth: s(40),
  },
  md: {
    tokenImageSize: '$8',
    chainImageSize: '$4',
    fallbackIconSize: '$6',
    tokenImageResizeWidth: s(32),
  },
  sm: {
    tokenImageSize: '$6',
    chainImageSize: '$3',
    fallbackIconSize: '$6',
    tokenImageResizeWidth: s(24),
  },
  xs: {
    tokenImageSize: '$5',
    chainImageSize: '$2.5',
    fallbackIconSize: '$5',
    tokenImageResizeWidth: s(20),
  },
  xxs: {
    tokenImageSize: '$4',
    chainImageSize: '$2',
    fallbackIconSize: '$4',
    tokenImageResizeWidth: s(16),
  },
};

export function getTokenImageResizeWidth(size: ITokenSize): number {
  return TOKEN_SIZE_MAP[size].tokenImageResizeWidth;
}
