import { Stack } from '@onekeyhq/components';

import { RichBlockContent } from './RichBlockContent';
import { RichBlockHeader } from './RichBlockHeader';

import type { IRichBlockProps } from './types';

function RichBlock(props: IRichBlockProps) {
  const {
    title,
    titleProps,
    headerActions,
    headerContainerProps,
    blockContainerProps,
    content,
    contentContainerProps,
  } = props;
  return (
    <Stack userSelect="none" pointerEvents="box-none" {...blockContainerProps}>
      {title || headerActions ? (
        <RichBlockHeader
          title={title}
          titleProps={titleProps}
          headerActions={headerActions}
          headerContainerProps={headerContainerProps}
        />
      ) : null}
      <RichBlockContent
        content={content}
        contentContainerProps={contentContainerProps}
      />
    </Stack>
  );
}

export { RichBlock };
