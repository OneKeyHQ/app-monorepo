import {
  parseMarkdown,
  stringifyMarkdown,
  markdownToHtml,
  htmlToMarkdown,
} from './markdownUtils';

describe('markdownUtils', () => {
  describe('parseMarkdown', () => {
    it('should parse markdown', () => {
      const md = '# Heading\n\nParagraph';
      const result = parseMarkdown(md);
      expect(result).toBeDefined();
    });
  });

  describe('stringifyMarkdown', () => {
    it('should stringify to markdown', () => {
      const obj = { type: 'heading', content: 'Title' };
      const result = stringifyMarkdown(obj);
      expect(result).toContain('#');
    });
  });

  describe('markdownToHtml', () => {
    it('should convert markdown to HTML', () => {
      const md = '# Heading';
      const result = markdownToHtml(md);
      expect(result).toContain('<h1>');
    });
  });

  describe('htmlToMarkdown', () => {
    it('should convert HTML to markdown', () => {
      const html = '<h1>Heading</h1>';
      const result = htmlToMarkdown(html);
      expect(result).toContain('#');
    });
  });
});
