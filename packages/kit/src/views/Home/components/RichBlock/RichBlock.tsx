import type {
  ISizableTextProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';

import { RichBlockHeader } from './RichBlockHeader';

export type IRichBlockProps = {
  title?: React.ReactNode;
  titleProps?: ISizableTextProps;
  headerActions?: React.ReactNode;
  headerContainerProps?: IXStackProps;

  blockContainerProps?: IStackProps;
};

function RichBlock(props: IRichBlockProps) {
  const {
    title,
    titleProps,
    headerActions,
    headerContainerProps,
    blockContainerProps,
  } = props;
  return (
    <Stack py="$3" px="$5" {...blockContainerProps}>
      {title || headerActions ? (
        <RichBlockHeader
          title={title}
          titleProps={titleProps}
          headerActions={headerActions}
          headerContainerProps={headerContainerProps}
        />
      ) : null}
    </Stack>
  );
}

export { RichBlock };
