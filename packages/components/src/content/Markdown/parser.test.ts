import { parseInline, parseMarkdown } from './parser';

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
    const nodes = parseInline('Escaped \\*text\\* &amp; (c)...  \nnext');

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({
      content: 'Escaped *text* & ©…',
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
});
