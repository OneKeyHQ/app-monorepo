import type { ReactNode } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import { Image, Pressable } from 'react-native';

import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useMedia } from '../../hooks/useStyle';
import { SizableText } from '../../primitives/SizeableText';
import { Stack, XStack, YStack } from '../../primitives/Stack';

import { parseMarkdown } from './parser';
import { getSafeMarkdownHref, getSafeMarkdownImageUri } from './urlUtils';

import type { IMarkdownNode } from './parser';
import type { ISizableTextProps } from '../../primitives';

const gtMdStyle = { h: '$5' } as const;

// Headings keep the body size token for line height and use the font sizes of
// the previous react-native-markdown-display renderer, so release notes look
// exactly as they did before the migration.
const headingConfigs = {
  heading1: { mt: '$9', fontSize: 32 },
  heading2: { pt: '$7', fontSize: 24 },
  heading3: { pt: '$5', fontSize: 18, fontWeight: '600' },
  heading4: { fontSize: 16 },
  heading5: { fontSize: 13 },
  heading6: { fontSize: 11 },
} as const;

const inlineMarkStyles = {
  em: { fontStyle: 'italic' },
  s: { textDecorationLine: 'line-through' },
  strong: { fontWeight: 'bold' },
} as const;

type IBodyTextSize = ISizableTextProps['size'];
// A nested SizableText re-applies its size token (font size, line height and
// weight), so each inline wrapper carries the full style of its ancestors.
type IInlineTextStyle = Pick<
  ISizableTextProps,
  'fontSize' | 'fontStyle' | 'fontWeight' | 'size' | 'textDecorationLine'
>;
type IRenderBlockNode = (
  node: IMarkdownNode,
  bodyTextSize: IBodyTextSize,
  key: string,
) => ReactNode;

function MarkdownImage({ alt, src }: { alt?: string; src?: string }) {
  const uri = getSafeMarkdownImageUri(src);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const imageSource = useMemo(() => ({ uri: uri ?? '' }), [uri]);
  const imageStyle = useMemo(
    () => ({ aspectRatio, width: '100%' as const }),
    [aspectRatio],
  );

  useEffect(() => {
    let active = true;
    if (uri) {
      Image.getSize(
        uri,
        (width, height) => {
          if (active && height > 0 && width > 0) {
            setAspectRatio(width / height);
          }
        },
        () => undefined,
      );
    }
    return () => {
      active = false;
    };
  }, [uri]);

  if (!uri) {
    return null;
  }

  return (
    <Image
      accessibilityLabel={alt}
      accessible={Boolean(alt)}
      resizeMode="contain"
      source={imageSource}
      style={imageStyle}
    />
  );
}

function MarkdownLink({
  children,
  href,
  ...textStyle
}: IInlineTextStyle & {
  children: ReactNode;
  href: string;
}) {
  const handlePress = useCallback(() => {
    openUrlExternal(href);
  }, [href]);

  return (
    <SizableText
      color="$text"
      cursor="pointer"
      onPress={handlePress}
      {...textStyle}
    >
      {children}
    </SizableText>
  );
}

function MarkdownMediaLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string | undefined;
}) {
  const safeHref = useMemo(() => getSafeMarkdownHref(href), [href]);
  const handlePress = useCallback(() => {
    if (safeHref) {
      openUrlExternal(safeHref);
    }
  }, [safeHref]);

  if (!safeHref) {
    return children;
  }

  return <Pressable onPress={handlePress}>{children}</Pressable>;
}

function renderInlineNode(
  node: IMarkdownNode,
  key: string,
  textStyle: IInlineTextStyle,
): ReactNode {
  const renderChildren = (childStyle: IInlineTextStyle) =>
    node.children.map((child, index) =>
      renderInlineNode(child, `${key}-inline-${index}`, childStyle),
    );

  switch (node.type) {
    case 'text':
      return node.content;
    case 'softbreak':
    case 'hardbreak':
      return '\n';
    case 'strong':
    case 'em':
    case 's': {
      const markStyle: IInlineTextStyle = {
        ...textStyle,
        ...inlineMarkStyles[node.type],
      };
      return (
        <SizableText key={key} color="$text" {...markStyle}>
          {renderChildren(markStyle)}
        </SizableText>
      );
    }
    case 'code_inline':
      return (
        <SizableText
          key={key}
          color="$text"
          {...textStyle}
          bg="$bgSubdued"
          borderColor="$borderSubdued"
          borderRadius="$1"
          borderWidth={1}
          fontFamily="$monoRegular"
          px="$1"
        >
          {node.content}
        </SizableText>
      );
    case 'link': {
      const href = getSafeMarkdownHref(node.attributes.href);
      if (!href) {
        return <Fragment key={key}>{renderChildren(textStyle)}</Fragment>;
      }
      // The previous renderer underlined links and kept the text color.
      const linkStyle: IInlineTextStyle = {
        ...textStyle,
        textDecorationLine: 'underline',
      };
      return (
        <MarkdownLink key={key} href={href} {...linkStyle}>
          {renderChildren(linkStyle)}
        </MarkdownLink>
      );
    }
    case 'image':
      return node.attributes.alt ?? '';
    default:
      if (node.children.length > 0) {
        return <Fragment key={key}>{renderChildren(textStyle)}</Fragment>;
      }
      return node.content || null;
  }
}

function renderInlineNodes(
  nodes: IMarkdownNode[],
  keyPrefix: string,
  textStyle: IInlineTextStyle,
) {
  return nodes.map((node, index) =>
    renderInlineNode(node, `${keyPrefix}-inline-${index}`, textStyle),
  );
}

function hasInlineImage(node: IMarkdownNode): boolean {
  return (
    node.type === 'image' ||
    node.children.some((child) => hasInlineImage(child))
  );
}

function renderMediaNode(
  node: IMarkdownNode,
  key: string,
  textStyle: IInlineTextStyle,
): ReactNode {
  if (node.type === 'image') {
    return (
      <MarkdownImage
        key={key}
        alt={node.attributes.alt}
        src={node.attributes.src}
      />
    );
  }

  const children = node.children.map((child, index) => {
    const childKey = `${key}-media-${index}`;
    if (hasInlineImage(child)) {
      return renderMediaNode(child, childKey, textStyle);
    }
    return (
      <SizableText key={childKey} color="$text" {...textStyle}>
        {renderInlineNode(child, childKey, textStyle)}
      </SizableText>
    );
  });

  if (node.type === 'link') {
    return (
      <MarkdownMediaLink key={key} href={node.attributes.href}>
        {children}
      </MarkdownMediaLink>
    );
  }

  return <YStack key={key}>{children}</YStack>;
}

function renderInlineContent(
  nodes: IMarkdownNode[],
  keyPrefix: string,
  textStyle: IInlineTextStyle,
  textAlign?: ISizableTextProps['textAlign'],
  // Line-box style of the wrapping text. Headings keep the body size here and
  // nest their own font size inside it, which sets the line height exactly as
  // the previous renderer did.
  containerStyle: IInlineTextStyle = textStyle,
) {
  if (!nodes.some((node) => hasInlineImage(node))) {
    const inlineNodes = renderInlineNodes(nodes, keyPrefix, textStyle);
    return (
      <SizableText color="$text" textAlign={textAlign} {...containerStyle}>
        {containerStyle === textStyle ? (
          inlineNodes
        ) : (
          <SizableText color="$text" {...textStyle}>
            {inlineNodes}
          </SizableText>
        )}
      </SizableText>
    );
  }

  const segments: Array<{
    containsImage: boolean;
    nodes: IMarkdownNode[];
  }> = [];
  nodes.forEach((node) => {
    const containsImage = hasInlineImage(node);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment?.containsImage === containsImage) {
      lastSegment.nodes.push(node);
    } else {
      segments.push({ containsImage, nodes: [node] });
    }
  });

  return (
    <YStack>
      {segments.map((segment, segmentIndex) => {
        const segmentKey = `${keyPrefix}-segment-${segmentIndex}`;
        if (segment.containsImage) {
          return segment.nodes.map((node, nodeIndex) =>
            renderMediaNode(node, `${segmentKey}-${nodeIndex}`, textStyle),
          );
        }
        return (
          <SizableText
            key={segmentKey}
            color="$text"
            textAlign={textAlign}
            {...textStyle}
          >
            {renderInlineNodes(segment.nodes, segmentKey, textStyle)}
          </SizableText>
        );
      })}
    </YStack>
  );
}

function renderHeading(
  node: IMarkdownNode,
  bodyTextSize: IBodyTextSize,
  key: string,
) {
  const config = headingConfigs[node.type as keyof typeof headingConfigs];
  const textStyle: IInlineTextStyle = {
    size: bodyTextSize,
    fontSize: config.fontSize,
  };
  if ('fontWeight' in config) {
    textStyle.fontWeight = config.fontWeight;
  }
  return (
    <Stack
      key={key}
      mt={'mt' in config ? config.mt : undefined}
      pt={'pt' in config ? config.pt : undefined}
    >
      {renderInlineContent(node.children, key, textStyle, undefined, {
        size: bodyTextSize,
      })}
    </Stack>
  );
}

function renderListItemChildren(
  nodes: IMarkdownNode[],
  bodyTextSize: IBodyTextSize,
  keyPrefix: string,
  renderBlock: IRenderBlockNode,
) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-content-${index}`;
    // As before, only the paragraph that opens a list item drops its block
    // spacing; later paragraphs keep their margins.
    if (node.type === 'paragraph' && index === 0) {
      return (
        <Fragment key={key}>
          {renderInlineContent(node.children, key, { size: bodyTextSize })}
        </Fragment>
      );
    }
    return renderBlock(node, bodyTextSize, key);
  });
}

function renderList(
  node: IMarkdownNode,
  bodyTextSize: IBodyTextSize,
  key: string,
  renderBlock: IRenderBlockNode,
) {
  const isOrdered = node.type === 'ordered_list';
  const start = node.attributes.start ?? 1;

  return (
    <YStack
      key={key}
      gap={isOrdered ? undefined : '$2'}
      pt={isOrdered ? undefined : '$2'}
    >
      {node.children.map((item, index) => {
        const itemKey = `${key}-item-${index}`;
        const children = renderListItemChildren(
          item.children,
          bodyTextSize,
          itemKey,
          renderBlock,
        );

        if (isOrdered) {
          return (
            <Stack key={itemKey}>
              <SizableText size="$bodyLg">
                {start + index}
                {item.markup || '.'}
              </SizableText>
              <Stack>{children}</Stack>
            </Stack>
          );
        }

        return (
          <XStack key={itemKey} alignItems="flex-start" gap="$2">
            <Stack
              $gtMd={gtMdStyle}
              alignItems="center"
              height="$6"
              justifyContent="center"
              width="$4.5"
            >
              <Stack
                bg="$textDisabled"
                borderRadius="$full"
                height={5}
                width={5}
              />
            </Stack>
            <YStack flex={1}>{children}</YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}

function renderTableCell(
  node: IMarkdownNode,
  key: string,
  bodyTextSize: IBodyTextSize,
  isHeader: boolean,
) {
  return (
    <Stack key={key} flex={1} p="$2">
      {renderInlineContent(
        node.children,
        key,
        isHeader
          ? { size: bodyTextSize, fontWeight: '600' }
          : { size: bodyTextSize },
        node.attributes.align,
      )}
    </Stack>
  );
}

function renderTable(
  node: IMarkdownNode,
  bodyTextSize: IBodyTextSize,
  key: string,
) {
  const rows = node.children.flatMap((section) => section.children);
  return (
    <YStack
      key={key}
      borderColor="$borderSubdued"
      borderRadius="$2"
      borderWidth={1}
      my="$2"
      overflow="hidden"
    >
      {rows.map((row, rowIndex) => {
        const rowKey = `${key}-row-${rowIndex}`;
        const isHeader = row.children.some((cell) => cell.type === 'th');
        return (
          <XStack
            key={rowKey}
            bg={isHeader ? '$bgSubdued' : undefined}
            borderBottomColor="$borderSubdued"
            borderBottomWidth={rowIndex === rows.length - 1 ? 0 : 1}
          >
            {row.children.map((cell, cellIndex) =>
              renderTableCell(
                cell,
                `${rowKey}-cell-${cellIndex}`,
                bodyTextSize,
                isHeader,
              ),
            )}
          </XStack>
        );
      })}
    </YStack>
  );
}

function renderBlockNode(
  node: IMarkdownNode,
  bodyTextSize: IBodyTextSize,
  key: string,
): ReactNode {
  if (node.type in headingConfigs) {
    return renderHeading(node, bodyTextSize, key);
  }

  switch (node.type) {
    case 'paragraph':
      return (
        <YStack key={key} my="$2.5">
          {renderInlineContent(node.children, key, { size: bodyTextSize })}
        </YStack>
      );
    case 'bullet_list':
    case 'ordered_list':
      return renderList(node, bodyTextSize, key, renderBlockNode);
    case 'blockquote':
      return (
        <YStack
          key={key}
          bg="$bgSubdued"
          borderLeftColor="$borderStrong"
          borderLeftWidth={4}
          my="$2"
          px="$2"
        >
          {node.children.map((child, index) =>
            renderBlockNode(child, bodyTextSize, `${key}-quote-${index}`),
          )}
        </YStack>
      );
    case 'code_block':
    case 'fence':
      return (
        <SizableText
          key={key}
          bg="$bgSubdued"
          borderColor="$borderSubdued"
          borderRadius="$2"
          borderWidth={1}
          color="$text"
          fontFamily="$monoRegular"
          my="$2"
          p="$2.5"
          size={bodyTextSize}
        >
          {node.content}
        </SizableText>
      );
    case 'hr':
      // Same 1px black rule, without margins, as the previous renderer.
      return <Stack key={key} bg="#000000" height={1} />;
    case 'table':
      return renderTable(node, bodyTextSize, key);
    case 'image':
      return (
        <MarkdownImage
          key={key}
          alt={node.attributes.alt}
          src={node.attributes.src}
        />
      );
    default:
      if (node.children.length > 0) {
        return (
          <Fragment key={key}>
            {node.children.map((child, index) =>
              renderBlockNode(child, bodyTextSize, `${key}-block-${index}`),
            )}
          </Fragment>
        );
      }
      return null;
  }
}

export function Markdown({ children }: { children: string }) {
  const { gtMd } = useMedia();
  const nodes = useMemo(() => parseMarkdown(children), [children]);
  const bodyTextSize: IBodyTextSize = gtMd ? '$bodyMd' : '$bodyLg';

  return (
    <YStack>
      {nodes.map((node, index) =>
        renderBlockNode(node, bodyTextSize, `markdown-block-${index}`),
      )}
    </YStack>
  );
}
