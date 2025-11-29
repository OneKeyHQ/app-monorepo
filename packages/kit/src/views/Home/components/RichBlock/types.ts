import type {
  ISizableTextProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';

export type IRichBlockProps = {
  title?: React.ReactNode;
  titleProps?: ISizableTextProps;
  headerActions?: React.ReactNode;
  headerContainerProps?: IXStackProps;

  content: React.ReactNode | undefined;
  contentContainerProps?: IStackProps;
  blockContainerProps?: IStackProps;
};
