import RNMarkdown from 'react-native-markdown-display';

import { SizableText, Stack } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';
import type { MarkdownProps } from 'react-native-markdown-display';

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
    size: '$bodyMd',
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    <SizableText key={node.key} {...styles.text} {...inheritedStyles}>
      {node.content}
    </SizableText>
  ),
  textgroup: (node, children) => (
    <SizableText key={node.key}>{children}</SizableText>
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <RNMarkdown rules={basicRules} style={basicStyles}>
      {children}
    </RNMarkdown>
  );
}
