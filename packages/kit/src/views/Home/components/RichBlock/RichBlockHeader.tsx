import { useCallback } from 'react';

import { SizableText, XStack } from '@onekeyhq/components';

import type { IRichBlockProps } from './types';

function RichBlockHeader(
  props: Pick<
    IRichBlockProps,
    | 'title'
    | 'titleProps'
    | 'withTitleSeparator'
    | 'subTitle'
    | 'subTitleProps'
    | 'headerActions'
    | 'headerContainerProps'
  >,
) {
  const {
    title,
    titleProps,
    subTitle,
    subTitleProps,
    withTitleSeparator,
    headerActions,
    headerContainerProps,
  } = props;

  const renderTitle = useCallback(() => {
    if (title || subTitle) {
      return (
        <XStack alignItems="center" gap="$1">
          {typeof title === 'string' ? (
            <SizableText size="$headingLg" {...titleProps}>
              {title}
            </SizableText>
          ) : (
            title
          )}
          {title && subTitle && withTitleSeparator ? (
            <SizableText size="$headingLg" color="$textSubdued" {...titleProps}>
              ·
            </SizableText>
          ) : null}
          {typeof subTitle === 'string' ? (
            <SizableText
              size="$headingLg"
              color="$textSubdued"
              {...subTitleProps}
            >
              {subTitle}
            </SizableText>
          ) : (
            subTitle
          )}
        </XStack>
      );
    }
    return null;
  }, [title, titleProps, subTitle, subTitleProps, withTitleSeparator]);

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
