import { SizableText, XStack } from '../../primitives';

import type {
  ISizableTextProps,
  IStackProps,
  IXStackProps,
} from '../../primitives';

export function SectionHeader({
  title,
  titleProps,
  children,
  ...restProps
}: IStackProps & {
  title?: string;
  titleProps?: ISizableTextProps;
}) {
  return (
    <XStack
      h="$9"
      px="$5"
      alignItems="center"
      bg="$bgApp"
      {...(restProps as IXStackProps)}
    >
      <SizableText
        numberOfLines={1}
        size="$headingSm"
        color="$textSubdued"
        {...titleProps}
      >
        {title}
      </SizableText>
      {children}
    </XStack>
  );
}
