import { YStack } from '../../primitives';

import type { IDialogContentProps } from './type';

export function Content({
  children,
  estimatedContentHeight,
}: IDialogContentProps) {
  if (!children) {
    return null;
  }
  return (
    <YStack px="$5" pb="$5" minHeight={estimatedContentHeight}>
      {children}
    </YStack>
  );
}
