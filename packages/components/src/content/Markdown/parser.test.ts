import { parseInline, parseMarkdown } from './parser';

import type { IMarkdownNode } from './parser';

describe('Markdown parser', () => {
  it('parses headings and common inline syntax', () => {
    const nodes = parseMarkdown(
      '# Title\n\nText with **bold**, _italic_, ~~removed~~, `code`, and [link](https://onekey.so).',
    );

    expect(nodes.map((node) => node.type)).toEqual(['heading1', 'paragraph']);
    expect(nodes[1].children.map((node) => node.type)).toEqual([
      'text',
      'strong',
      'text',
      'em',
      'text',
      's',
      'text',
      'code_inline',
      'text',
      'link',
      'text',
    ]);
    expect(nodes[1].children[9].attributes.href).toBe('https://onekey.so');
  });

  it('parses nested lists, blockquotes, fenced code, rules, and tables', () => {
    const nodes = parseMarkdown(`- First
- Second
  1. Nested one
  2. Nested two

> Quoted **text**

\`\`\`ts
const value = 1;
\`\`\`

---

| Name | State |
| :--- | ---: |
| OneKey | Ready |`);

    expect(nodes.map((node) => node.type)).toEqual([
      'bullet_list',
      'blockquote',
      'fence',
      'hr',
      'table',
    ]);
    expect(nodes[0].children[1].children[1].type).toBe('ordered_list');
    expect(nodes[2]).toMatchObject({
      attributes: { language: 'ts' },
      content: 'const value = 1;',
    });
    expect(nodes[4].children[0].children[0].children[0].attributes.align).toBe(
      'left',
    );
    expect(nodes[4].children[1].children[0].children[1].attributes.align).toBe(
      'right',
    );
  });

  it('supports reference links, images, autolinks, and setext headings', () => {
    const nodes = parseMarkdown(`Release notes
=============

[Website][onekey] ![Logo](assets.onekey.so/logo.png "OneKey") <support@onekey.so>

[onekey]: https://onekey.so "Homepage"`);
    const inlineNodes = nodes[1].children;

    expect(nodes[0].type).toBe('heading1');
    expect(inlineNodes[0]).toMatchObject({
      attributes: {
        href: 'https://onekey.so',
        title: 'Homepage',
      },
      type: 'link',
    });
    expect(inlineNodes[2]).toMatchObject({
      attributes: {
        alt: 'Logo',
        src: 'assets.onekey.so/logo.png',
        title: 'OneKey',
      },
      type: 'image',
    });
    expect(inlineNodes[4].attributes.href).toBe('mailto:support@onekey.so');
  });

  it('handles escapes, entities, typographic replacements, and hard breaks', () => {
    const nodes = parseInline(
      'Escaped \\*text\\* &amp; &mdash; &euro; (c)...  \nnext',
    );

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({
      content: 'Escaped *text* & — € ©…',
      type: 'text',
    });
    expect(nodes[1].type).toBe('hardbreak');
    expect(nodes[2]).toMatchObject({ content: 'next', type: 'text' });
  });

  it('ends a list before an unindented paragraph after a blank line', () => {
    const nodes = parseMarkdown('- List item\n\nOutside paragraph');

    expect(nodes.map((node) => node.type)).toEqual([
      'bullet_list',
      'paragraph',
    ]);
  });

  it('preserves underscores inside identifiers', () => {
    const nodes = parseInline('account_id_value and _italic_ and __bold__');

    expect(nodes.map((node) => node.type)).toEqual([
      'text',
      'em',
      'text',
      'strong',
    ]);
    expect(nodes[0].content).toBe('account_id_value and ');
  });

  it('preserves reference-like lines inside code blocks', () => {
    const nodes = parseMarkdown(`\`\`\`
[config]: literal fenced value
\`\`\`

    [config]: literal indented value

[Config][config]

[config]: https://onekey.so`);

    expect(nodes.map((node) => node.type)).toEqual([
      'fence',
      'code_block',
      'paragraph',
    ]);
    expect(nodes[0].content).toBe('[config]: literal fenced value');
    expect(nodes[1].content.trimEnd()).toBe('[config]: literal indented value');
    expect(nodes[2].children[0].attributes.href).toBe('https://onekey.so');
  });

  it('separates ordered lists when their delimiters change', () => {
    const nodes = parseMarkdown('1. First\n2) Second');

    expect(nodes.map((node) => node.type)).toEqual([
      'ordered_list',
      'ordered_list',
    ]);
    expect(nodes[0].attributes.start).toBe(1);
    expect(nodes[1].attributes.start).toBe(2);
  });

  it('keeps lazy quote and non-interrupting paragraph continuations', () => {
    const quoteNodes = parseMarkdown('> First line\ncontinued line\n\nOutside');
    const paragraphNodes = parseMarkdown(
      'Summary\n    indented continuation\n2. numbered continuation',
    );

    expect(quoteNodes.map((node) => node.type)).toEqual([
      'blockquote',
      'paragraph',
    ]);
    expect(quoteNodes[0].children[0].content).toBe(
      'First line\ncontinued line',
    );
    expect(paragraphNodes).toHaveLength(1);
    expect(paragraphNodes[0].type).toBe('paragraph');
  });

  it('limits recursive block parsing depth', () => {
    const nodes = parseMarkdown(`${'> '.repeat(40)}Deep content`);
    let depth = 0;
    let node = nodes[0];

    while (node?.type === 'blockquote') {
      depth += 1;
      [node] = node.children;
    }

    expect(depth).toBe(32);
    expect(node.type).toBe('paragraph');
  });
});

describe('Markdown parser parity with the previous markdown-it renderer', () => {
  const inlineText = (nodes: IMarkdownNode[]): string =>
    nodes
      .map((node) => {
        if (node.type === 'text') {
          return node.content;
        }
        if (node.type === 'softbreak' || node.type === 'hardbreak') {
          return '\n';
        }
        return inlineText(node.children);
      })
      .join('');

  it('keeps a single list item followed by a rule as a list', () => {
    const nodes = parseMarkdown(
      '### 💎 改进\r\n- 改进了性能和修复微小错误\r\n---\r\n\r\n**Full Changelog**: v1...v2',
    );

    expect(nodes.map((node) => node.type)).toEqual([
      'heading3',
      'bullet_list',
      'hr',
      'paragraph',
    ]);
    expect(inlineText(nodes[1].children[0].children[0].children)).toBe(
      '改进了性能和修复微小错误',
    );
  });

  it('still turns a paragraph followed by an underline into a heading', () => {
    const nodes = parseMarkdown('First line\nsecond line\n---\nAfter');

    expect(nodes.map((node) => node.type)).toEqual(['heading2', 'paragraph']);
    expect(inlineText(nodes[0].children)).toBe('First line\nsecond line');
  });

  it('treats markers left of the content column as sibling items', () => {
    const nodes = parseMarkdown(
      '- Add support for Algorand tokens\r\n - Add support for Ripple\r\n  - Add support for Aptos',
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].children).toHaveLength(3);
    expect(
      nodes[0].children.every((item) =>
        item.children.every((child) => child.type === 'paragraph'),
      ),
    ).toBe(true);
  });

  it('applies the same smart quotes and replacements', () => {
    expect(
      inlineText(
        parseInline(
          'Added "Check for updates" to Ledger\'s list -- fast --- (p) +- wow!!!! really?.... ok,,',
        ),
      ),
    ).toBe(
      'Added “Check for updates” to Ledger’s list – fast — § ± wow!!! really?.. ok,',
    );
    expect(
      inlineText(parseInline('Support "**bold** quotes" and \'single\'')),
    ).toBe('Support “bold quotes” and ‘single’');
    expect(
      inlineText(
        parseInline("L'ensemble \"Trezor兼容模式\" 与 'Trezor兼容模式' 配置"),
      ),
    ).toBe('L’ensemble “Trezor兼容模式” 与 ‘Trezor兼容模式’ 配置');
    expect(inlineText(parseInline('Size 12" screen and "quoted"'))).toBe(
      'Size 12" screen and “quoted”',
    );
  });

  it('drops the spaces around line breaks', () => {
    const nodes = parseInline('one \n   two   \nthree');

    expect(nodes.map((node) => node.type)).toEqual([
      'text',
      'softbreak',
      'text',
      'hardbreak',
      'text',
    ]);
    expect(nodes.map((node) => node.content)).toEqual([
      'one',
      '',
      'two',
      '',
      'three',
    ]);
  });

  it('trims paragraphs and closing heading sequences', () => {
    const nodes = parseMarkdown('  Indented paragraph  \n\n## Title ##\n\n# #');

    expect(nodes[0].children[0].content).toBe('Indented paragraph');
    expect(inlineText(nodes[1].children)).toBe('Title');
    expect(nodes[2].children).toHaveLength(0);
  });

  it('parses adversarial input in linear time', () => {
    const inputs = [
      `a${' '.repeat(100_000)}b  \nc`,
      '['.repeat(100_000),
      '!['.repeat(50_000),
      '_a '.repeat(33_000),
      '[a](<'.repeat(20_000),
      '[a]('.repeat(25_000),
      '"a '.repeat(16_000) + "a' ".repeat(16_000),
      `# a${' #'.repeat(50_000)}`,
    ];
    const startedAt = Date.now();
    inputs.forEach((input) => parseMarkdown(input));
    // Quadratic behavior takes tens of seconds here; linear parsing takes
    // well under a second even on slow CI machines.
    expect(Date.now() - startedAt).toBeLessThan(3000);
  });
});
