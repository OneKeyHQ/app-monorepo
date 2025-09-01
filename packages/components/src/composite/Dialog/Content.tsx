import { YStack } from '../../primitives';

import type { IDialogContentProps } from './type';
import type { IYStackProps } from '../../primitives';

export function Content({
  children,
  estimatedContentHeight,
  isAsync = false,
  ...others
}: IDialogContentProps & Omit<IYStackProps, 'children'>) {
  if (!children) {
    return null;
  }
  if (isAsync) {
    // do nothing, isAsync is only available on Content.native.tsx
  }
  return (
    <YStack px="$5" pb="$5" minHeight={estimatedContentHeight} {...others}>
      {children}
    </YStack>
  );
}
