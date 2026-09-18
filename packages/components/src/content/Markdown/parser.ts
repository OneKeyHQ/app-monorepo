/* eslint-disable no-continue -- Token scanners advance immediately after consuming a Markdown construct. */
// cspell:ignore apos darr emsp harr hellip laquo larr ldquo lsquo middot ndash plusmn raquo rarr rdquo rsquo thinsp uarr setext rescanning GHSA fmfq

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

const MAX_MARKDOWN_DEPTH = 32;

const namedEntities: Record<string, string> = {
  amp: '&',
  apos: "'",
  bull: '•',
  cent: '¢',
  copy: '©',
  darr: '↓',
  deg: '°',
  divide: '÷',
  emsp: '\u2003',
  euro: '€',
  ge: '≥',
  gt: '>',
  harr: '↔',
  hellip: '…',
  laquo: '«',
  larr: '←',
  ldquo: '“',
  le: '≤',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  middot: '·',
  nbsp: '\u00A0',
  ndash: '–',
  ne: '≠',
  para: '¶',
  plusmn: '±',
  pound: '£',
  quot: '"',
  raquo: '»',
  rarr: '→',
  rdquo: '”',
  reg: '®',
  rsquo: '’',
  sect: '§',
  thinsp: '\u2009',
  times: '×',
  trade: '™',
  uarr: '↑',
  yen: '¥',
};

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

  return namedEntities[entity.toLowerCase()] ?? `&${entity};`;
}

const scopedAbbreviations: Record<string, string> = {
  c: '©',
  p: '§',
  r: '®',
  tm: '™',
};

// Typographer replacements from markdown-it 10, the parser behind the previous
// react-native-markdown-display renderer, so existing release notes keep the
// exact same glyphs.
function replaceTypography(value: string) {
  const text = value.replace(
    /\((c|tm|r|p)\)/gi,
    (_, name: string) => scopedAbbreviations[name.toLowerCase()],
  );
  if (!/\+-|\.\.|\?\?\?\?|!!!!|,,|--/.test(text)) {
    return text;
  }
  return text
    .replace(/\+-/g, '±')
    .replace(/\.{2,}/g, '…')
    .replace(/([?!])…/g, '$1..')
    .replace(/([?!]){4,}/g, '$1$1$1')
    .replace(/,{2,}/g, ',')
    .replace(/(^|[^-])---([^-]|$)/gm, '$1—$2')
    .replace(/(^|\s)--(\s|$)/gm, '$1–$2')
    .replace(/(^|[^-\s])--([^-\s]|$)/gm, '$1–$2');
}

function formatText(value: string) {
  return replaceTypography(
    value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (_, entity) =>
      decodeEntity(String(entity)),
    ),
  );
}

// Unicode punctuation (General Category P) from uc.micro 1.0.6, the table
// markdown-it 10 used for smart quotes. Kept as literal ranges because Hermes
// has no reliable \p{...} support.
const unicodePunctuation =
  // eslint-disable-next-line no-useless-escape -- verbatim uc.micro table
  /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDF55-\uDF59]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD806[\uDC3B\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/;

function isQuoteWhiteSpace(code: number) {
  return (
    (code >= 0x20_00 && code <= 0x20_0a) ||
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x0d ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x16_80 ||
    code === 0x20_2f ||
    code === 0x20_5f ||
    code === 0x30_00
  );
}

function isQuotePunctuation(code: number) {
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e) ||
    unicodePunctuation.test(String.fromCharCode(code))
  );
}

interface IQuoteToken {
  level: number;
  node?: IMarkdownNode;
  type: 'break' | 'other' | 'text';
}

interface IQuoteOpener {
  level: number;
  position: number;
  previousSameQuote: number;
  single: boolean;
  tokenIndex: number;
}

function flattenQuoteTokens(
  nodes: IMarkdownNode[],
  level: number,
  tokens: IQuoteToken[],
) {
  nodes.forEach((node) => {
    if (node.type === 'text') {
      tokens.push({ level, node, type: 'text' });
    } else if (node.type === 'softbreak' || node.type === 'hardbreak') {
      tokens.push({ level, type: 'break' });
    } else if (
      node.type === 'strong' ||
      node.type === 'em' ||
      node.type === 's' ||
      node.type === 'link'
    ) {
      tokens.push({ level, type: 'other' });
      flattenQuoteTokens(node.children, level + 1, tokens);
      tokens.push({ level, type: 'other' });
    } else {
      tokens.push({ level, type: 'other' });
    }
  });
  return tokens;
}

function findQuoteNeighbor(
  tokens: IQuoteToken[],
  from: number,
  step: 1 | -1,
): number {
  for (let index = from; index >= 0 && index < tokens.length; index += step) {
    const { node, type } = tokens[index];
    if (type === 'break') {
      break;
    }
    if (type === 'text' && node) {
      return step < 0
        ? node.content.charCodeAt(node.content.length - 1)
        : node.content.charCodeAt(0);
    }
  }
  return 0x20;
}

// Smart quotes with markdown-it 10 semantics. The opener lookup and batched
// replacements follow markdown-it 15.0.2, which fixed the quadratic cases of
// the original rule (GHSA-6v5v-wf23-fmfq and mismatched quote types).
function applySmartQuotes(nodes: IMarkdownNode[]) {
  const tokens = flattenQuoteTokens(nodes, 0, []);
  if (
    !tokens.some(
      ({ node, type }) => type === 'text' && /['"]/.test(node?.content ?? ''),
    )
  ) {
    return nodes;
  }

  const stack: IQuoteOpener[] = [];
  const heads = { double: -1, single: -1 };
  const replacements = new Map<number, Array<[number, string]>>();
  const replaceQuote = (
    tokenIndex: number,
    position: number,
    value: string,
  ) => {
    const tokenReplacements = replacements.get(tokenIndex) ?? [];
    tokenReplacements.push([position, value]);
    replacements.set(tokenIndex, tokenReplacements);
  };
  const truncateStack = (length: number) => {
    while (stack.length > length) {
      const opener = stack.pop();
      if (opener?.single) {
        heads.single = opener.previousSameQuote;
      } else if (opener) {
        heads.double = opener.previousSameQuote;
      }
    }
  };

  tokens.forEach(({ level, node, type }, tokenIndex) => {
    let keep = stack.length;
    while (keep > 0 && stack[keep - 1].level > level) {
      keep -= 1;
    }
    truncateStack(keep);
    if (type !== 'text' || !node) {
      return;
    }

    const text = node.content;
    const quotePattern = /['"]/g;
    let match = quotePattern.exec(text);
    while (match) {
      const position = match.index;
      const single = match[0] === "'";
      const lastChar =
        position > 0
          ? text.charCodeAt(position - 1)
          : findQuoteNeighbor(tokens, tokenIndex - 1, -1);
      const nextChar =
        position + 1 < text.length
          ? text.charCodeAt(position + 1)
          : findQuoteNeighbor(tokens, tokenIndex + 1, 1);
      const isLastPunctuation = isQuotePunctuation(lastChar);
      const isNextPunctuation = isQuotePunctuation(nextChar);
      const isLastWhiteSpace = isQuoteWhiteSpace(lastChar);
      const isNextWhiteSpace = isQuoteWhiteSpace(nextChar);

      let canOpen = !isNextWhiteSpace;
      if (canOpen && isNextPunctuation) {
        canOpen = isLastWhiteSpace || isLastPunctuation;
      }
      let canClose = !isLastWhiteSpace;
      if (canClose && isLastPunctuation) {
        canClose = isNextWhiteSpace || isNextPunctuation;
      }
      // `1""`: the first quote is an inch mark.
      if (
        !single &&
        nextChar === 0x22 &&
        lastChar >= 0x30 &&
        lastChar <= 0x39
      ) {
        canOpen = false;
        canClose = false;
      }
      if (canOpen && canClose) {
        canOpen = false;
        canClose = isNextPunctuation;
      }

      if (!canOpen && !canClose) {
        if (single) {
          replaceQuote(tokenIndex, position, '’');
        }
      } else {
        const openerIndex = single ? heads.single : heads.double;
        if (
          canClose &&
          openerIndex >= 0 &&
          stack[openerIndex].level === level
        ) {
          const opener = stack[openerIndex];
          replaceQuote(tokenIndex, position, single ? '’' : '”');
          replaceQuote(opener.tokenIndex, opener.position, single ? '‘' : '“');
          truncateStack(openerIndex);
        } else if (canOpen) {
          stack.push({
            level,
            position,
            previousSameQuote: single ? heads.single : heads.double,
            single,
            tokenIndex,
          });
          if (single) {
            heads.single = stack.length - 1;
          } else {
            heads.double = stack.length - 1;
          }
        } else if (single) {
          replaceQuote(tokenIndex, position, '’');
        }
      }
      match = quotePattern.exec(text);
    }
  });

  replacements.forEach((tokenReplacements, tokenIndex) => {
    const { node } = tokens[tokenIndex];
    if (!node) {
      return;
    }
    const characters = node.content.split('');
    tokenReplacements.forEach(([position, value]) => {
      characters[position] = value;
    });
    node.content = characters.join('');
  });
  return nodes;
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

// Matches every `[` with its closing `]` in one pass. Scanning forward from
// each `[` separately made unmatched brackets quadratic.
function createClosingBracketFinder(source: string) {
  let closingBrackets: Map<number, number> | undefined;
  return (openingIndex: number) => {
    if (!closingBrackets) {
      closingBrackets = new Map();
      const openingBrackets: number[] = [];
      for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\\') {
          index += 1;
          continue;
        }
        if (source[index] === '[') {
          openingBrackets.push(index);
        } else if (source[index] === ']') {
          const opening = openingBrackets.pop();
          if (opening !== undefined) {
            closingBrackets.set(opening, index);
          }
        }
      }
    }
    return closingBrackets.get(openingIndex) ?? -1;
  };
}

type IClosingBracketFinder = ReturnType<typeof createClosingBracketFinder>;

// Same nesting limit markdown-it applies to link destinations; it keeps a run
// of unclosed `[a](` from rescanning the rest of the text for every link.
const MAX_LINK_PAREN_DEPTH = 32;

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
      // `<` cannot appear inside a `<...>` destination.
      if (angleBracket) {
        return undefined;
      }
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
      if (depth > MAX_LINK_PAREN_DEPTH) {
        return undefined;
      }
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
  depth: number,
  findClosingBracket: IClosingBracketFinder,
): IParsedLink | undefined {
  const openingBracket = start + (isImage ? 1 : 0);
  const closingBracket = findClosingBracket(openingBracket);
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
    const referenceEnd = findClosingBracket(end);
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
      children: parseInlineNodes(label, references, depth),
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

const autoLinkPattern =
  /<(https?:\/\/[^\s<>]+|mailto:[^\s<>]+|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/iy;

function getEmphasisAt(source: string, index: number) {
  return emphasisMarkers.find(({ marker }) => source.startsWith(marker, index));
}

function isAsciiWordCharacter(character: string | undefined) {
  return Boolean(character && /[A-Za-z0-9]/.test(character));
}

function canOpenEmphasis(source: string, index: number, marker: string) {
  if (!marker.includes('_')) {
    return true;
  }
  const previous = source[index - 1];
  const next = source[index + marker.length];
  return (
    Boolean(next && !/\s/.test(next)) &&
    !(isAsciiWordCharacter(previous) && isAsciiWordCharacter(next))
  );
}

function canCloseEmphasis(source: string, index: number, marker: string) {
  if (!marker.includes('_')) {
    return true;
  }
  const previous = source[index - 1];
  const next = source[index + marker.length];
  return (
    Boolean(previous && !/\s/.test(previous)) &&
    !(isAsciiWordCharacter(previous) && isAsciiWordCharacter(next))
  );
}

// Walks the same marker occurrences as a plain forward search, but remembers
// the answer for every occurrence it visits. Openers such as `_a _a _a` would
// otherwise rescan the rest of the text for each `_`.
function createClosingEmphasisFinder(source: string) {
  const answers = new Map<string, Map<number, number>>();
  return (marker: string, from: number) => {
    let markerAnswers = answers.get(marker);
    if (!markerAnswers) {
      markerAnswers = new Map();
      answers.set(marker, markerAnswers);
    }
    const visited: number[] = [];
    let result = -1;
    let cursor = from;
    while (cursor < source.length) {
      const closingIndex = findUnescaped(source, marker, cursor);
      if (closingIndex < 0) {
        break;
      }
      const known = markerAnswers.get(closingIndex);
      if (known !== undefined) {
        result = known;
        break;
      }
      visited.push(closingIndex);
      if (canCloseEmphasis(source, closingIndex, marker)) {
        result = closingIndex;
        break;
      }
      cursor = closingIndex + marker.length;
    }
    visited.forEach((position) => markerAnswers?.set(position, result));
    return result;
  };
}

function parseInlineNodes(
  source: string,
  references: ReadonlyMap<string, ILinkDefinition>,
  depth: number,
): IMarkdownNode[] {
  if (depth >= MAX_MARKDOWN_DEPTH) {
    return [createNode('text', { content: formatText(source) })];
  }

  const nodes: IMarkdownNode[] = [];
  const findClosingBracket = createClosingBracketFinder(source);
  const findClosingEmphasis = createClosingEmphasisFinder(source);
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
      // markdown-it drops the spaces around a line break; two or more
      // trailing spaces make it a hard break.
      let textEnd = buffer.length;
      while (textEnd > 0 && buffer[textEnd - 1] === ' ') {
        textEnd -= 1;
      }
      let hardBreak = buffer.length - textEnd >= 2;
      buffer = buffer.slice(0, textEnd);
      if (!hardBreak && buffer.endsWith('\\')) {
        buffer = buffer.slice(0, -1);
        hardBreak = true;
      }
      flushText();
      nodes.push(createNode(hardBreak ? 'hardbreak' : 'softbreak'));
      index += 1;
      while (source[index] === ' ' || source[index] === '\t') {
        index += 1;
      }
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
      const image = parseLink(
        source,
        index,
        references,
        true,
        depth + 1,
        findClosingBracket,
      );
      if (image) {
        flushText();
        nodes.push(image.node);
        index = image.end;
        continue;
      }
    }

    if (character === '[') {
      const link = parseLink(
        source,
        index,
        references,
        false,
        depth + 1,
        findClosingBracket,
      );
      if (link) {
        flushText();
        nodes.push(link.node);
        index = link.end;
        continue;
      }
    }

    if (character === '<') {
      // Sticky match on the full source: slicing per `<` copies the tail on
      // Hermes and turns long runs of `<` quadratic.
      autoLinkPattern.lastIndex = index;
      const autoLink = autoLinkPattern.exec(source);
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
    if (emphasis && canOpenEmphasis(source, index, emphasis.marker)) {
      const contentStart = index + emphasis.marker.length;
      const closingIndex = findClosingEmphasis(emphasis.marker, contentStart);
      if (closingIndex > contentStart) {
        flushText();
        let children = parseInlineNodes(
          source.slice(contentStart, closingIndex),
          references,
          depth + 1,
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

export function parseInline(
  source: string,
  references: ReadonlyMap<string, ILinkDefinition> = new Map(),
  depth = 0,
) {
  const nodes = parseInlineNodes(source, references, depth);
  // markdown-it only ran smart quotes when the raw block contained a quote.
  return /['"]/.test(source) ? applySmartQuotes(nodes) : nodes;
}

// Removes an optional closing `###` sequence and surrounding whitespace with a
// linear scan; the previous regex backtracked quadratically on long runs.
function stripClosingHeadingSequence(value: string) {
  let end = value.length;
  while (end > 0 && /[ \t]/.test(value[end - 1])) {
    end -= 1;
  }
  let hashStart = end;
  while (hashStart > 0 && value[hashStart - 1] === '#') {
    hashStart -= 1;
  }
  if (
    hashStart < end &&
    (hashStart === 0 || /[ \t]/.test(value[hashStart - 1]))
  ) {
    end = hashStart;
  }
  return value.slice(0, end).trim();
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

function isParagraphInterrupt(lines: string[], index: number) {
  const line = lines[index];
  const listItem = matchListItem(line);
  const listCanInterrupt = Boolean(
    listItem && (!listItem.ordered || listItem.start === 1),
  );
  return (
    /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line) ||
    /^ {0,3}>/.test(line) ||
    listCanInterrupt ||
    isFence(line) ||
    isHorizontalRule(line) ||
    isTableStart(lines, index)
  );
}

function parseTable(
  lines: string[],
  index: number,
  references: ReadonlyMap<string, ILinkDefinition>,
  depth: number,
) {
  const headers = splitTableRow(lines[index]);
  const alignments = getTableAlignments(lines[index + 1]) ?? [];
  const headerCells = headers.map((cell, cellIndex) =>
    createNode('th', {
      attributes: { align: alignments[cellIndex] },
      children: parseInline(cell, references, depth + 1),
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
            children: parseInline(
              cells[cellIndex] ?? '',
              references,
              depth + 1,
            ),
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
  depth: number,
) {
  const items: IMarkdownNode[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const item = matchListItem(lines[cursor]);
    if (
      !item ||
      item.indent > 3 ||
      item.ordered !== firstItem.ordered ||
      item.delimiter !== firstItem.delimiter
    ) {
      break;
    }

    const itemLines = [item.content];
    let nextIndex = cursor + 1;
    let hasBlankLine = false;
    while (nextIndex < lines.length) {
      const line = lines[nextIndex];
      const nextItem = matchListItem(line);
      // A marker left of this item's content column starts a sibling item
      // (CommonMark 5.2), so ` - b` under `- a` is not a nested list.
      if (
        nextItem &&
        nextItem.indent < item.contentIndent &&
        nextItem.indent <= 3 &&
        nextItem.ordered === firstItem.ordered &&
        nextItem.delimiter === firstItem.delimiter
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
      if (hasBlankLine && lineIndent < item.contentIndent) {
        break;
      }
      if (lineIndent < item.contentIndent && isBlockStart(lines, nextIndex)) {
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
        children: parseBlocks(itemLines, references, depth + 1),
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
  depth = 0,
) {
  if (depth >= MAX_MARKDOWN_DEPTH) {
    const content = lines.join('\n');
    return content.trim()
      ? [
          createNode('paragraph', {
            children: parseInline(content, references, depth),
            content,
          }),
        ]
      : [];
  }

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
      const content = stripClosingHeadingSequence(headingMatch[2] ?? '');
      nodes.push(
        createNode(`heading${level}` as IMarkdownNodeType, {
          children: parseInline(content, references, depth + 1),
          markup: headingMatch[1],
        }),
      );
      index += 1;
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
        if (quoteMatch) {
          quoteLines.push(quoteMatch[1]);
          cursor += 1;
        } else if (
          lines[cursor].trim() &&
          !isParagraphInterrupt(lines, cursor)
        ) {
          quoteLines.push(lines[cursor]);
          cursor += 1;
        } else {
          break;
        }
      }
      nodes.push(
        createNode('blockquote', {
          children: parseBlocks(quoteLines, references, depth + 1),
          markup: '>',
        }),
      );
      index = cursor;
      continue;
    }

    const listItem = matchListItem(line);
    if (listItem) {
      const list = parseList(lines, index, references, listItem, depth);
      nodes.push(list.node);
      index = list.nextIndex;
      continue;
    }

    if (isTableStart(lines, index)) {
      const table = parseTable(lines, index, references, depth);
      nodes.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraphLines = [line];
    let cursor = index + 1;
    let setextMarkup = '';
    while (cursor < lines.length && lines[cursor].trim()) {
      // Only a paragraph can take a setext underline; a `---` right after a
      // list item or quote is a thematic break (CommonMark 4.3).
      if (/^ {0,3}(=+|-+)\s*$/.test(lines[cursor])) {
        setextMarkup = lines[cursor].trim();
        break;
      }
      if (isParagraphInterrupt(lines, cursor)) {
        break;
      }
      paragraphLines.push(lines[cursor]);
      cursor += 1;
    }
    const content = paragraphLines.join('\n').trim();
    if (setextMarkup) {
      nodes.push(
        createNode(setextMarkup.startsWith('=') ? 'heading1' : 'heading2', {
          children: parseInline(content.trim(), references, depth + 1),
          markup: setextMarkup,
        }),
      );
      index = cursor + 1;
      continue;
    }
    nodes.push(
      createNode('paragraph', {
        children: parseInline(content, references, depth + 1),
        content,
      }),
    );
    index = cursor;
  }

  return nodes;
}

function extractReferences(lines: string[]) {
  const references = new Map<string, ILinkDefinition>();
  const contentLines: string[] = [];
  let openFence = '';

  lines.forEach((line) => {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (openFence) {
      contentLines.push(line);
      if (
        fenceMatch &&
        fenceMatch[1][0] === openFence[0] &&
        fenceMatch[1].length >= openFence.length &&
        /^ {0,3}(`+|~+)\s*$/.test(line)
      ) {
        openFence = '';
      }
      return;
    }
    if (fenceMatch) {
      openFence = fenceMatch[1];
      contentLines.push(line);
      return;
    }

    const match = line.match(
      /^ {0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*$/,
    );
    if (!match) {
      contentLines.push(line);
      return;
    }
    const rawHref = match[2];
    references.set(normalizeReference(match[1]), {
      href: unescapeMarkdown(
        rawHref.startsWith('<') ? rawHref.slice(1, -1) : rawHref,
      ),
      title: match[3] ?? match[4] ?? match[5],
    });
    contentLines.push('');
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
