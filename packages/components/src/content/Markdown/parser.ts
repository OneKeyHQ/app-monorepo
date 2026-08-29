/* eslint-disable no-continue -- Token scanners advance immediately after consuming a Markdown construct. */

export type IMarkdownNodeType =
  | 'blockquote'
  | 'bullet_list'
  | 'code_block'
  | 'code_inline'
  | 'em'
  | 'fence'
  | 'hardbreak'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'hr'
  | 'image'
  | 'link'
  | 'list_item'
  | 'ordered_list'
  | 'paragraph'
  | 's'
  | 'softbreak'
  | 'strong'
  | 'table'
  | 'tbody'
  | 'td'
  | 'text'
  | 'th'
  | 'thead'
  | 'tr';

export interface IMarkdownNode {
  attributes: {
    align?: 'center' | 'left' | 'right';
    alt?: string;
    href?: string;
    language?: string;
    src?: string;
    start?: number;
    title?: string;
  };
  children: IMarkdownNode[];
  content: string;
  markup: string;
  type: IMarkdownNodeType;
}

interface ILinkDefinition {
  href: string;
  title?: string;
}

interface IListMatch {
  content: string;
  contentIndent: number;
  delimiter: string;
  indent: number;
  ordered: boolean;
  start: number;
}

interface IParsedLink {
  end: number;
  node: IMarkdownNode;
}

const escapedPunctuation = new Set('\\`*{}[]()#+-.!_>~|'.split(''));

function createNode(
  type: IMarkdownNodeType,
  options: Partial<Omit<IMarkdownNode, 'type'>> = {},
): IMarkdownNode {
  return {
    attributes: options.attributes ?? {},
    children: options.children ?? [],
    content: options.content ?? '',
    markup: options.markup ?? '',
    type,
  };
}

function normalizeReference(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function unescapeMarkdown(value: string) {
  return value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
}

function decodeEntity(entity: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00A0',
    quot: '"',
  };

  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const value = Number.parseInt(entity.slice(2), 16);
    return Number.isInteger(value) && value >= 0 && value <= 1_114_111
      ? String.fromCodePoint(value)
      : `&${entity};`;
  }

  if (entity.startsWith('#')) {
    const value = Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(value) && value >= 0 && value <= 1_114_111
      ? String.fromCodePoint(value)
      : `&${entity};`;
  }

  return namedEntities[entity] ?? `&${entity};`;
}

function formatText(value: string) {
  return value
    .replace(/&(#(?:x[\da-f]+|\d+)|amp|apos|gt|lt|nbsp|quot);/gi, (_, entity) =>
      decodeEntity(String(entity)),
    )
    .replace(/\(c\)/gi, '©')
    .replace(/\(r\)/gi, '®')
    .replace(/\(tm\)/gi, '™')
    .replace(/\.{3}/g, '…');
}

function findUnescaped(source: string, marker: string, from: number) {
  let cursor = from;
  while (cursor < source.length) {
    const found = source.indexOf(marker, cursor);
    if (found < 0) {
      return -1;
    }

    let slashCount = 0;
    for (
      let index = found - 1;
      index >= 0 && source[index] === '\\';
      index -= 1
    ) {
      slashCount += 1;
    }
    if (slashCount % 2 === 0) {
      return found;
    }
    cursor = found + marker.length;
  }
  return -1;
}

function findClosingBracket(source: string, openingIndex: number) {
  let depth = 0;
  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === '[') {
      depth += 1;
    } else if (source[index] === ']') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function readParenthesized(source: string, openingIndex: number) {
  let depth = 0;
  let angleBracket = false;
  let quote = '';

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      index += 1;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '<') {
      angleBracket = true;
      continue;
    }
    if (character === '>' && angleBracket) {
      angleBracket = false;
      continue;
    }
    if (!angleBracket && (character === '"' || character === "'")) {
      quote = character;
      continue;
    }
    if (!angleBracket && character === '(') {
      depth += 1;
    } else if (!angleBracket && character === ')') {
      depth -= 1;
      if (depth === 0) {
        return {
          end: index,
          value: source.slice(openingIndex + 1, index),
        };
      }
    }
  }
  return undefined;
}

function parseLinkTarget(value: string): ILinkDefinition | undefined {
  const trimmedValue = value.trim();
  const angleMatch = trimmedValue.match(
    /^<([^>]+)>(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/,
  );
  if (angleMatch) {
    return {
      href: unescapeMarkdown(angleMatch[1]),
      title: angleMatch[2] ?? angleMatch[3] ?? angleMatch[4],
    };
  }

  const targetMatch = trimmedValue.match(
    /^(\S+?)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?$/,
  );
  if (!targetMatch) {
    return undefined;
  }
  return {
    href: unescapeMarkdown(targetMatch[1]),
    title: targetMatch[2] ?? targetMatch[3] ?? targetMatch[4],
  };
}

function parseLink(
  source: string,
  start: number,
  references: ReadonlyMap<string, ILinkDefinition>,
  isImage: boolean,
): IParsedLink | undefined {
  const openingBracket = start + (isImage ? 1 : 0);
  const closingBracket = findClosingBracket(source, openingBracket);
  if (closingBracket < 0) {
    return undefined;
  }

  const label = source.slice(openingBracket + 1, closingBracket);
  let definition: ILinkDefinition | undefined;
  let end = closingBracket + 1;

  if (source[end] === '(') {
    const destination = readParenthesized(source, end);
    if (!destination) {
      return undefined;
    }
    definition = parseLinkTarget(destination.value);
    end = destination.end + 1;
  } else if (source[end] === '[') {
    const referenceEnd = findClosingBracket(source, end);
    if (referenceEnd < 0) {
      return undefined;
    }
    const referenceLabel = source.slice(end + 1, referenceEnd) || label;
    definition = references.get(normalizeReference(referenceLabel));
    end = referenceEnd + 1;
  } else {
    definition = references.get(normalizeReference(label));
  }

  if (!definition) {
    return undefined;
  }

  if (isImage) {
    return {
      end,
      node: createNode('image', {
        attributes: {
          alt: unescapeMarkdown(label),
          src: definition.href,
          title: definition.title,
        },
        content: unescapeMarkdown(label),
        markup: '!',
      }),
    };
  }

  return {
    end,
    node: createNode('link', {
      attributes: {
        href: definition.href,
        title: definition.title,
      },
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- Inline links can recursively contain inline Markdown.
      children: parseInline(label, references),
      markup: '[]',
    }),
  };
}

function findCodeSpanEnd(source: string, start: number, size: number) {
  const marker = '`'.repeat(size);
  let cursor = start;
  while (cursor < source.length) {
    const found = source.indexOf(marker, cursor);
    if (found < 0) {
      return -1;
    }
    if (source[found - 1] !== '`' && source[found + size] !== '`') {
      return found;
    }
    cursor = found + size;
  }
  return -1;
}

function normalizeCodeSpan(value: string) {
  const normalizedValue = value.replace(/\n/g, ' ');
  if (
    normalizedValue.startsWith(' ') &&
    normalizedValue.endsWith(' ') &&
    normalizedValue.trim().length > 0
  ) {
    return normalizedValue.slice(1, -1);
  }
  return normalizedValue;
}

const emphasisMarkers: Array<{
  marker: string;
  type: 'em' | 's' | 'strong';
}> = [
  { marker: '***', type: 'strong' },
  { marker: '___', type: 'strong' },
  { marker: '**', type: 'strong' },
  { marker: '__', type: 'strong' },
  { marker: '~~', type: 's' },
  { marker: '*', type: 'em' },
  { marker: '_', type: 'em' },
];

function getEmphasisAt(source: string, index: number) {
  return emphasisMarkers.find(({ marker }) => source.startsWith(marker, index));
}

export function parseInline(
  source: string,
  references: ReadonlyMap<string, ILinkDefinition> = new Map(),
) {
  const nodes: IMarkdownNode[] = [];
  let buffer = '';
  let index = 0;

  const flushText = () => {
    if (buffer) {
      nodes.push(createNode('text', { content: formatText(buffer) }));
      buffer = '';
    }
  };

  while (index < source.length) {
    const character = source[index];

    if (
      character === '\\' &&
      source[index + 1] &&
      escapedPunctuation.has(source[index + 1])
    ) {
      buffer += source[index + 1];
      index += 2;
      continue;
    }

    if (character === '\n') {
      let hardBreak = false;
      if (buffer.endsWith('  ')) {
        buffer = buffer.slice(0, -2);
        hardBreak = true;
      } else if (buffer.endsWith('\\')) {
        buffer = buffer.slice(0, -1);
        hardBreak = true;
      }
      flushText();
      nodes.push(createNode(hardBreak ? 'hardbreak' : 'softbreak'));
      index += 1;
      continue;
    }

    if (character === '`') {
      let markerSize = 1;
      while (source[index + markerSize] === '`') {
        markerSize += 1;
      }
      const contentStart = index + markerSize;
      const closingIndex = findCodeSpanEnd(source, contentStart, markerSize);
      if (closingIndex >= 0) {
        flushText();
        nodes.push(
          createNode('code_inline', {
            content: normalizeCodeSpan(
              source.slice(contentStart, closingIndex),
            ),
            markup: '`'.repeat(markerSize),
          }),
        );
        index = closingIndex + markerSize;
        continue;
      }
    }

    if (character === '!' && source[index + 1] === '[') {
      const image = parseLink(source, index, references, true);
      if (image) {
        flushText();
        nodes.push(image.node);
        index = image.end;
        continue;
      }
    }

    if (character === '[') {
      const link = parseLink(source, index, references, false);
      if (link) {
        flushText();
        nodes.push(link.node);
        index = link.end;
        continue;
      }
    }

    if (character === '<') {
      const remainingSource = source.slice(index);
      const autoLink = remainingSource.match(
        /^<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/i,
      );
      if (autoLink) {
        const visibleText = autoLink[1].replace(/^mailto:/i, '');
        const href =
          autoLink[1].includes('@') && !autoLink[1].includes(':')
            ? `mailto:${autoLink[1]}`
            : autoLink[1];
        flushText();
        nodes.push(
          createNode('link', {
            attributes: { href },
            children: [createNode('text', { content: visibleText })],
            markup: '<>',
          }),
        );
        index += autoLink[0].length;
        continue;
      }
    }

    const emphasis = getEmphasisAt(source, index);
    if (emphasis) {
      const contentStart = index + emphasis.marker.length;
      const closingIndex = findUnescaped(source, emphasis.marker, contentStart);
      if (closingIndex > contentStart) {
        flushText();
        let children = parseInline(
          source.slice(contentStart, closingIndex),
          references,
        );
        if (emphasis.marker.length === 3) {
          children = [
            createNode('em', { children, markup: emphasis.marker[0] }),
          ];
        }
        nodes.push(
          createNode(emphasis.type, {
            children,
            markup: emphasis.marker,
          }),
        );
        index = closingIndex + emphasis.marker.length;
        continue;
      }
    }

    buffer += character;
    index += 1;
  }

  flushText();
  return nodes;
}

function countIndent(value: string) {
  let indent = 0;
  for (const character of value) {
    if (character === ' ') {
      indent += 1;
    } else if (character === '\t') {
      indent += 4;
    } else {
      break;
    }
  }
  return indent;
}

function stripIndent(value: string, indentToStrip: number) {
  let strippedIndent = 0;
  let index = 0;
  while (index < value.length && strippedIndent < indentToStrip) {
    if (value[index] === ' ') {
      strippedIndent += 1;
      index += 1;
    } else if (value[index] === '\t') {
      strippedIndent += 4;
      index += 1;
    } else {
      break;
    }
  }
  return value.slice(index);
}

function matchListItem(line: string): IListMatch | undefined {
  const match = line.match(/^(\s*)(?:(\d+)([.)])|([-+*]))[ \t]+(.*)$/);
  if (!match) {
    return undefined;
  }
  const indent = countIndent(match[1]);
  const ordered = Boolean(match[2]);
  const prefixLength = match[0].length - match[5].length;
  return {
    content: match[5],
    contentIndent: prefixLength,
    delimiter: ordered ? match[3] : match[4],
    indent,
    ordered,
    start: ordered ? Number.parseInt(match[2], 10) : 1,
  };
}

function isHorizontalRule(line: string) {
  const compactLine = line.trim().replace(/\s/g, '');
  return (
    /^\*{3,}$/.test(compactLine) ||
    /^-{3,}$/.test(compactLine) ||
    /^_{3,}$/.test(compactLine)
  );
}

function isFence(line: string) {
  return /^ {0,3}(`{3,}|~{3,})/.test(line);
}

function splitTableRow(line: string) {
  const trimmedLine = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cell = '';
  let codeMarkerSize = 0;

  for (let index = 0; index < trimmedLine.length; index += 1) {
    const character = trimmedLine[index];
    if (character === '\\' && trimmedLine[index + 1] === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (character === '`') {
      let markerSize = 1;
      while (trimmedLine[index + markerSize] === '`') {
        markerSize += 1;
      }
      if (codeMarkerSize === 0) {
        codeMarkerSize = markerSize;
      } else if (codeMarkerSize === markerSize) {
        codeMarkerSize = 0;
      }
      cell += '`'.repeat(markerSize);
      index += markerSize - 1;
      continue;
    }
    if (character === '|' && codeMarkerSize === 0) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function getTableAlignments(line: string) {
  const cells = splitTableRow(line);
  if (
    cells.length === 0 ||
    cells.some((cell) => !/^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
  ) {
    return undefined;
  }
  return cells.map((cell): 'center' | 'left' | 'right' | undefined => {
    const normalizedCell = cell.replace(/\s/g, '');
    if (normalizedCell.startsWith(':') && normalizedCell.endsWith(':')) {
      return 'center';
    }
    if (normalizedCell.endsWith(':')) {
      return 'right';
    }
    if (normalizedCell.startsWith(':')) {
      return 'left';
    }
    return undefined;
  });
}

function isTableStart(lines: string[], index: number) {
  return (
    index + 1 < lines.length &&
    lines[index].includes('|') &&
    Boolean(getTableAlignments(lines[index + 1]))
  );
}

function isBlockStart(lines: string[], index: number) {
  const line = lines[index];
  return (
    /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line) ||
    /^ {0,3}>/.test(line) ||
    /^ {4}\S/.test(line) ||
    Boolean(matchListItem(line)) ||
    isFence(line) ||
    isHorizontalRule(line) ||
    isTableStart(lines, index)
  );
}

function parseTable(
  lines: string[],
  index: number,
  references: ReadonlyMap<string, ILinkDefinition>,
) {
  const headers = splitTableRow(lines[index]);
  const alignments = getTableAlignments(lines[index + 1]) ?? [];
  const headerCells = headers.map((cell, cellIndex) =>
    createNode('th', {
      attributes: { align: alignments[cellIndex] },
      children: parseInline(cell, references),
    }),
  );
  const header = createNode('thead', {
    children: [createNode('tr', { children: headerCells })],
  });

  const rows: IMarkdownNode[] = [];
  let cursor = index + 2;
  while (
    cursor < lines.length &&
    lines[cursor].trim() &&
    lines[cursor].includes('|')
  ) {
    const cells = splitTableRow(lines[cursor]);
    rows.push(
      createNode('tr', {
        children: headers.map((_, cellIndex) =>
          createNode('td', {
            attributes: { align: alignments[cellIndex] },
            children: parseInline(cells[cellIndex] ?? '', references),
          }),
        ),
      }),
    );
    cursor += 1;
  }

  return {
    nextIndex: cursor,
    node: createNode('table', {
      children: [header, createNode('tbody', { children: rows })],
    }),
  };
}

function parseList(
  lines: string[],
  index: number,
  references: ReadonlyMap<string, ILinkDefinition>,
  firstItem: IListMatch,
) {
  const items: IMarkdownNode[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const item = matchListItem(lines[cursor]);
    if (
      !item ||
      item.indent !== firstItem.indent ||
      item.ordered !== firstItem.ordered
    ) {
      break;
    }

    const itemLines = [item.content];
    let nextIndex = cursor + 1;
    let hasBlankLine = false;
    while (nextIndex < lines.length) {
      const line = lines[nextIndex];
      const nextItem = matchListItem(line);
      if (
        nextItem &&
        nextItem.indent === firstItem.indent &&
        nextItem.ordered === firstItem.ordered
      ) {
        break;
      }
      if (!line.trim()) {
        itemLines.push('');
        hasBlankLine = true;
        nextIndex += 1;
        continue;
      }

      const lineIndent = countIndent(line);
      if (hasBlankLine && lineIndent <= firstItem.indent) {
        break;
      }
      if (lineIndent <= firstItem.indent && isBlockStart(lines, nextIndex)) {
        break;
      }
      if (lineIndent < firstItem.indent) {
        break;
      }
      itemLines.push(
        lineIndent > firstItem.indent
          ? stripIndent(line, item.contentIndent)
          : line.trimStart(),
      );
      nextIndex += 1;
    }

    items.push(
      createNode('list_item', {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- Nested list items recursively contain block Markdown.
        children: parseBlocks(itemLines, references),
        markup: item.delimiter,
      }),
    );
    cursor = nextIndex;
  }

  return {
    nextIndex: cursor,
    node: createNode(firstItem.ordered ? 'ordered_list' : 'bullet_list', {
      attributes: firstItem.ordered ? { start: firstItem.start } : {},
      children: items,
      markup: firstItem.delimiter,
    }),
  };
}

function parseBlocks(
  lines: string[],
  references: ReadonlyMap<string, ILinkDefinition>,
) {
  const nodes: IMarkdownNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)?.*$/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const content: string[] = [];
      let cursor = index + 1;
      const closingFence = new RegExp(
        `^ {0,3}${marker[0]}{${marker.length},}\\s*$`,
      );
      while (cursor < lines.length && !closingFence.test(lines[cursor])) {
        content.push(lines[cursor]);
        cursor += 1;
      }
      nodes.push(
        createNode('fence', {
          attributes: { language: fenceMatch[2] || undefined },
          content: content.join('\n'),
          markup: marker,
        }),
      );
      index = cursor < lines.length ? cursor + 1 : cursor;
      continue;
    }

    if (/^ {4}/.test(line)) {
      const content: string[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        if (/^ {4}/.test(lines[cursor])) {
          content.push(lines[cursor].slice(4));
        } else if (!lines[cursor].trim()) {
          content.push('');
        } else {
          break;
        }
        cursor += 1;
      }
      nodes.push(createNode('code_block', { content: content.join('\n') }));
      index = cursor;
      continue;
    }

    const headingMatch = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = (headingMatch[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '');
      nodes.push(
        createNode(`heading${level}` as IMarkdownNodeType, {
          children: parseInline(content, references),
          markup: headingMatch[1],
        }),
      );
      index += 1;
      continue;
    }

    if (
      index + 1 < lines.length &&
      line.trim() &&
      /^ {0,3}(=+|-+)\s*$/.test(lines[index + 1])
    ) {
      const markup = lines[index + 1].trim();
      nodes.push(
        createNode(markup.startsWith('=') ? 'heading1' : 'heading2', {
          children: parseInline(line.trim(), references),
          markup,
        }),
      );
      index += 2;
      continue;
    }

    if (isHorizontalRule(line)) {
      nodes.push(createNode('hr', { markup: line.trim() }));
      index += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      let cursor = index;
      while (cursor < lines.length) {
        const quoteMatch = lines[cursor].match(/^ {0,3}> ?(.*)$/);
        if (!quoteMatch) {
          break;
        }
        quoteLines.push(quoteMatch[1]);
        cursor += 1;
      }
      nodes.push(
        createNode('blockquote', {
          children: parseBlocks(quoteLines, references),
          markup: '>',
        }),
      );
      index = cursor;
      continue;
    }

    const listItem = matchListItem(line);
    if (listItem) {
      const list = parseList(lines, index, references, listItem);
      nodes.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index, references);
      nodes.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraphLines = [line];
    let cursor = index + 1;
    while (cursor < lines.length && lines[cursor].trim()) {
      if (isBlockStart(lines, cursor)) {
        break;
      }
      paragraphLines.push(lines[cursor]);
      cursor += 1;
    }
    const content = paragraphLines.join('\n');
    nodes.push(
      createNode('paragraph', {
        children: parseInline(content, references),
        content,
      }),
    );
    index = cursor;
  }

  return nodes;
}

function extractReferences(lines: string[]) {
  const references = new Map<string, ILinkDefinition>();
  const contentLines = lines.map((line) => {
    const match = line.match(
      /^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/,
    );
    if (!match) {
      return line;
    }
    const rawHref = match[2];
    references.set(normalizeReference(match[1]), {
      href: unescapeMarkdown(
        rawHref.startsWith('<') ? rawHref.slice(1, -1) : rawHref,
      ),
      title: match[3] ?? match[4] ?? match[5],
    });
    return '';
  });
  return { contentLines, references };
}

export function parseMarkdown(source: string) {
  const normalizedSource = source.replace(/\r\n?/g, '\n');
  const { contentLines, references } = extractReferences(
    normalizedSource.split('\n'),
  );
  return parseBlocks(contentLines, references);
}
