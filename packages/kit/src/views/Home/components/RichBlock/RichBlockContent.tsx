import { StyleSheet } from 'react-native';

import { Stack } from '@onekeyhq/components';

import type { IRichBlockProps } from './types';

function RichBlockContent({
  content,
  contentContainerProps,
  plainContentContainer,
}: Pick<
  IRichBlockProps,
  'content' | 'contentContainerProps' | 'plainContentContainer'
>) {
  if (plainContentContainer) {
    return <Stack {...contentContainerProps}>{content}</Stack>;
  }
  return (
    <Stack
      py="$2"
      borderRadius="$3"
      borderCurve="continuous"
      $platform-web={{
        boxShadow:
          '0 0 0 1px rgba(0, 0, 0, 0.04), 0 0 2px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      }}
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $theme-dark={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-ios={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 0.5 },
        shadowOpacity: 0.2,
        shadowRadius: 0.5,
      }}
      overflow="hidden"
      {...contentContainerProps}
    >
      {content}
    </Stack>
  );
}

export { RichBlockContent };
