import {
  parseXML,
  stringifyXML,
  xmlToJson,
  jsonToXml,
} from './xmlUtils';

describe('xmlUtils', () => {
  describe('parseXML', () => {
    it('should parse XML string', () => {
      const xml = '<root><item>value</item></root>';
      const result = parseXML(xml);
      expect(result).toBeDefined();
    });
  });

  describe('stringifyXML', () => {
    it('should stringify to XML', () => {
      const obj = { root: { item: 'value' } };
      const result = stringifyXML(obj);
      expect(result).toContain('<root>');
    });
  });

  describe('xmlToJson', () => {
    it('should convert XML to JSON', () => {
      const xml = '<root><item>value</item></root>';
      const result = xmlToJson(xml);
      expect(result.root.item).toBe('value');
    });
  });

  describe('jsonToXml', () => {
    it('should convert JSON to XML', () => {
      const json = { root: { item: 'value' } };
      const result = jsonToXml(json);
      expect(result).toContain('<item>value</item>');
    });
  });
});
