import {
  parseYAML,
  stringifyYAML,
  yamlToJson,
  jsonToYaml,
} from './yamlUtils';

describe('yamlUtils', () => {
  describe('parseYAML', () => {
    it('should parse YAML string', () => {
      const yaml = 'name: Alice\nage: 30';
      const result = parseYAML(yaml);
      expect(result.name).toBe('Alice');
      expect(result.age).toBe(30);
    });
  });

  describe('stringifyYAML', () => {
    it('should stringify to YAML', () => {
      const obj = { name: 'Alice', age: 30 };
      const result = stringifyYAML(obj);
      expect(result).toContain('name: Alice');
    });
  });

  describe('yamlToJson', () => {
    it('should convert YAML to JSON', () => {
      const yaml = 'name: Alice';
      const result = yamlToJson(yaml);
      expect(result.name).toBe('Alice');
    });
  });

  describe('jsonToYaml', () => {
    it('should convert JSON to YAML', () => {
      const json = { name: 'Alice' };
      const result = jsonToYaml(json);
      expect(result).toContain('name: Alice');
    });
  });
});
