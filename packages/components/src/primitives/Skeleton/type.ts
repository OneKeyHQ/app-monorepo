import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';

export type ISkeletonProps = StackStyle & {
  radius?: 'round' | 'square' | number;
  colorMode?: 'dark' | 'light';
  children?: React.ReactNode;
  show?: boolean;
};
