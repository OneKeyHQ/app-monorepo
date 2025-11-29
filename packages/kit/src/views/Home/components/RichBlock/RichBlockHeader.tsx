import { useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import type { IRichBlockProps } from './types';

function RichBlockHeader(
  props: Pick<
    IRichBlockProps,
    'title' | 'titleProps' | 'headerActions' | 'headerContainerProps'
  >,
) {
  const { title, titleProps, headerActions, headerContainerProps } = props;

  const renderTitle = useCallback(() => {
    if (typeof title === 'string') {
      return (
        <SizableText
          size="$headingLg"
          $md={{
            size: '$bodyLgMedium',
          }}
          {...titleProps}
        >
          {title}
        </SizableText>
      );
    }
    return title;
  }, [title, titleProps]);

  return (
    <XStack
      py="$3"
      $md={{ py: '$2' }}
      justifyContent="space-between"
      alignItems="center"
      gap="$2"
      {...headerContainerProps}
    >
      {renderTitle()}
      {headerActions}
    </XStack>
  );
}

export { RichBlockHeader };
