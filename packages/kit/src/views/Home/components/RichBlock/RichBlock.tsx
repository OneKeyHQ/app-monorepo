import { Stack } from '@onekeyhq/components';

import { RichBlockContent } from './RichBlockContent';
import { RichBlockHeader } from './RichBlockHeader';

import type { IRichBlockProps } from './types';

function RichBlock(props: IRichBlockProps) {
  const {
    title,
    subTitle,
    titleProps,
    subTitleProps,
    withTitleSeparator,
    headerActions,
    headerContainerProps,
    blockContainerProps,
    content,
    contentContainerProps,
    plainContentContainer,
  } = props;
  return (
    <Stack userSelect="none" pointerEvents="box-none" {...blockContainerProps}>
      {title || subTitle || headerActions ? (
        <RichBlockHeader
          title={title}
          titleProps={titleProps}
          subTitle={subTitle}
          subTitleProps={subTitleProps}
          withTitleSeparator={withTitleSeparator}
          headerActions={headerActions}
          headerContainerProps={headerContainerProps}
        />
      ) : null}
      <RichBlockContent
        content={content}
        contentContainerProps={contentContainerProps}
        plainContentContainer={plainContentContainer}
      />
    </Stack>
  );
}

export { RichBlock };
