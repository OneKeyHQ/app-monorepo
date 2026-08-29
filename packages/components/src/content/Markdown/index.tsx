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

const headingConfigs = {
  heading1: { mt: '$9', size: '$headingXl' },
  heading2: { pt: '$7', size: '$headingLg' },
  heading3: { pt: '$5', size: '$headingMd' },
  heading4: { size: '$bodyLgMedium' },
  heading5: { size: '$bodyMdMedium' },
  heading6: { size: '$bodySmMedium' },
} as const;

type IBodyTextSize = ISizableTextProps['size'];
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

  return (
    <SizableText
      color="$textInfo"
      cursor="pointer"
      onPress={handlePress}
      textDecorationLine="underline"
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

function renderInlineNode(node: IMarkdownNode, key: string): ReactNode {
  const children = node.children.map((child, index) =>
    renderInlineNode(child, `${key}-inline-${index}`),
  );

  switch (node.type) {
    case 'text':
      return node.content;
    case 'softbreak':
    case 'hardbreak':
      return '\n';
    case 'strong':
      return (
        <SizableText key={key} fontWeight="700">
          {children}
        </SizableText>
      );
    case 'em':
      return (
        <SizableText key={key} fontStyle="italic">
          {children}
        </SizableText>
      );
    case 's':
      return (
        <SizableText key={key} textDecorationLine="line-through">
          {children}
        </SizableText>
      );
    case 'code_inline':
      return (
        <SizableText
          key={key}
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
    case 'link':
      return (
        <MarkdownLink key={key} href={node.attributes.href}>
          {children}
        </MarkdownLink>
      );
    case 'image':
      return node.attributes.alt ?? '';
    default:
      if (children.length > 0) {
        return <Fragment key={key}>{children}</Fragment>;
      }
      return node.content || null;
  }
}

function renderInlineNodes(nodes: IMarkdownNode[], keyPrefix: string) {
  return nodes.map((node, index) =>
    renderInlineNode(node, `${keyPrefix}-inline-${index}`),
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
  bodyTextSize: IBodyTextSize,
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
      return renderMediaNode(child, childKey, bodyTextSize);
    }
    return (
      <SizableText key={childKey} color="$text" size={bodyTextSize}>
        {renderInlineNode(child, childKey)}
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
  size: IBodyTextSize,
  fontWeight?: ISizableTextProps['fontWeight'],
  textAlign?: ISizableTextProps['textAlign'],
) {
  if (!nodes.some((node) => hasInlineImage(node))) {
    return (
      <SizableText
        color="$text"
        fontWeight={fontWeight}
        size={size}
        textAlign={textAlign}
      >
        {renderInlineNodes(nodes, keyPrefix)}
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
            renderMediaNode(node, `${segmentKey}-${nodeIndex}`, size),
          );
        }
        return (
          <SizableText
            key={segmentKey}
            color="$text"
            fontWeight={fontWeight}
            size={size}
            textAlign={textAlign}
          >
            {renderInlineNodes(segment.nodes, segmentKey)}
          </SizableText>
        );
      })}
    </YStack>
  );
}

function renderHeading(node: IMarkdownNode, key: string) {
  const config = headingConfigs[node.type as keyof typeof headingConfigs];
  return (
    <Stack
      key={key}
      mt={'mt' in config ? config.mt : undefined}
      pt={'pt' in config ? config.pt : undefined}
    >
      {renderInlineContent(node.children, key, config.size)}
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
    if (node.type === 'paragraph') {
      return (
        <Fragment key={key}>
          {renderInlineContent(node.children, key, bodyTextSize)}
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
    <YStack key={key} gap="$2" pt="$2">
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
        bodyTextSize,
        isHeader ? '600' : undefined,
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
    return renderHeading(node, key);
  }

  switch (node.type) {
    case 'paragraph':
      return (
        <YStack key={key} my="$2.5">
          {renderInlineContent(node.children, key, bodyTextSize)}
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
      return <Stack key={key} bg="$borderSubdued" height={1} my="$2.5" />;
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
