import { useMemo } from 'react';

import RNMarkdown from 'react-native-markdown-display';
import { useMedia } from 'tamagui';

import { SizableText, Stack, XStack, YStack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { ASTNode, MarkdownProps } from 'react-native-markdown-display';

function hasParents(parents: ASTNode[], type: string) {
  return parents.findIndex((el) => el.type === type) > -1;
}

const basicRules: MarkdownProps['rules'] = {
  heading1: (node, children) => (
    <Stack key={node.key} mt="$9">
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
  textgroup: (node, children, parent, styles) => (
    <SizableText
      key={node.key}
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      {...styles.text}
    >
      {children}
    </SizableText>
  ),
  bullet_list: (node, children) => (
    <YStack gap="$2" pt="$2">
      {children}
    </YStack>
  ),
  list_item: (node, children, parent) => {
    if (hasParents(parent, 'bullet_list')) {
      return (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        <XStack key={node.key} gap="$2">
          <Stack ai="center" jc="center" w="$4.5" h="$6" $gtMd={{ h: '$5' }}>
            <Stack bg="$textDisabled" w={5} h={5} borderRadius="$full" />
          </Stack>
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
  const { gtMd } = useMedia();
  const basicStyles = useMemo(
    () =>
      ({
        heading1: {
          color: '$text',
          size: '$headingXl',
        } as ISizableTextProps,
        heading2: {
          color: '$text',
          size: '$headingLg',
        } as ISizableTextProps,
        heading3: {
          color: '$text',
          size: '$headingMd',
          fontWeight: '600',
        } as ISizableTextProps,
        text: {
          color: '$text',
          size: gtMd ? '$bodyMd' : '$bodyLg',
        } as ISizableTextProps,
      } as MarkdownProps['style']),
    [gtMd],
  );
  return (
    <RNMarkdown rules={basicRules} style={basicStyles}>
      {children}
    </RNMarkdown>
  );
}
