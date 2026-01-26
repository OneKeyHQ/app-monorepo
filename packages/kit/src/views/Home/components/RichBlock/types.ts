import type {
  ISizableTextProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';

export type IRichBlockProps = {
  title?: React.ReactNode;
  titleProps?: ISizableTextProps;
  withTitleSeparator?: boolean;
  subTitle?: React.ReactNode;
  subTitleProps?: ISizableTextProps;
  headerActions?: React.ReactNode;
  headerContainerProps?: IXStackProps;

  content: React.ReactNode | undefined;
  contentContainerProps?: IStackProps;
  plainContentContainer?: boolean;
  blockContainerProps?: IStackProps;
};
