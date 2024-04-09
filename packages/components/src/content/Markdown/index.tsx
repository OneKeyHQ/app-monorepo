import { Platform } from 'react-native';
import RNMarkdown from 'react-native-markdown-display';

import { SizableText, Stack, XStack, YStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { ASTNode, MarkdownProps } from 'react-native-markdown-display';

function hasParents(parents: ASTNode[], type: string) {
  return parents.findIndex((el) => el.type === type) > -1;
}

const basicStyles = {
  heading1: {
    size: '$headingXl',
  } as ISizableTextProps,
  heading2: {
    size: '$headingLg',
  } as ISizableTextProps,
  heading3: {
    size: '$headingMd',
  } as ISizableTextProps,
  text: {
    size: '$bodyLg',
  } as ISizableTextProps,
} as MarkdownProps['style'];

const basicRules: MarkdownProps['rules'] = {
  heading1: (node, children) => (
    <Stack key={node.key} pt="$9">
      {children}
    </Stack>
  ),
  heading2: (node, children) => (
    <Stack key={node.key} pt="$7">
      {children}
    </Stack>
  ),
  heading3: (node, children) => (
    <Stack key={node.key} pt="$5">
      {children}
    </Stack>
  ),
  text: (node, children, parent, styles, inheritedStyles = {}) => (
    <SizableText
      key={node.key}
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      {...styles.text}
      {...inheritedStyles}
    >
      {node.content}
    </SizableText>
  ),
  textgroup: (node, children) => (
    <SizableText key={node.key}>{children}</SizableText>
  ),
  bullet_list: (node, children) => (
    <YStack space="$2" pt="$2">
      {children}
    </YStack>
  ),
  list_item: (node, children, parent, styles, inheritedStyles = {}) => {
    if (hasParents(parent, 'bullet_list')) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        <XStack key={node.key} space="$1">
          <SizableText
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            accessible={false}
            size="$bodyLg"
          >
            {Platform.select({
              android: '\u2022',
              ios: '\u00B7',
              default: '\u2022',
            })}
          </SizableText>
          <Stack flexShrink={1}>{children}</Stack>
        </XStack>
      );
    }

    if (hasParents(parent, 'ordered_list')) {
      const orderedListIndex = parent.findIndex(
        (el) => el.type === 'ordered_list',
      );

      const orderedList = parent[orderedListIndex];
      let listItemNumber;

      if (orderedList.attributes && orderedList.attributes.start) {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        listItemNumber = orderedList.attributes.start + node.index;
      } else {
        listItemNumber = node.index + 1;
      }

      return (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        <Stack key={node.key}>
          <SizableText size="$bodyLg">
            {listItemNumber}
            {node.markup}
          </SizableText>
          <Stack>{children}</Stack>
        </Stack>
      );
    }

    // we should not need this, but just in case
    return <Stack key={node.key}>{children}</Stack>;
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <RNMarkdown rules={basicRules} style={basicStyles}>
      {children}
    </RNMarkdown>
  );
}
