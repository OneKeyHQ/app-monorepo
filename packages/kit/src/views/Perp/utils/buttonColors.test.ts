import fs from 'fs';
import path from 'path';

import ts from 'typescript';

function literalAttribute(
  attributes: ts.JsxAttributes,
  name: string,
): string | undefined {
  const attribute = attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText() === name,
  );
  const value = attribute?.initializer;
  if (value && ts.isStringLiteral(value)) return value.text;
  if (
    value &&
    ts.isJsxExpression(value) &&
    value.expression &&
    ts.isStringLiteral(value.expression)
  ) {
    return value.expression.text;
  }
  return undefined;
}

function checkButtonColors(source: ts.SourceFile) {
  const failures: string[] = [];
  function visit(node: ts.Node, background?: string) {
    let nextBackground = background;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const attributes = opening.attributes;
      const variant = literalAttribute(attributes, 'variant');
      nextBackground =
        literalAttribute(attributes, 'bg') ??
        literalAttribute(attributes, 'backgroundColor') ??
        (variant === 'accent' ? '$bgAccent' : undefined) ??
        (variant === 'destructive' ? '$bgCriticalStrong' : undefined) ??
        background;
      const color = literalAttribute(attributes, 'color');
      if (
        color === '$textOnColor' &&
        ['$bgAccent', '$bgActive', '$bgStrong', '$bgSubdued'].includes(
          nextBackground ?? '',
        )
      ) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        failures.push(`${source.fileName}:${line + 1}`);
      }
    }
    ts.forEachChild(node, (child) => visit(child, nextBackground));
  }
  visit(source);
  return failures;
}

function parse(name: string, source: string) {
  return ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

it('rejects fixed white labels on accent or neutral backgrounds in Perps', () => {
  expect(
    checkButtonColors(
      parse(
        'bad.tsx',
        '<Button variant="accent"><SizableText color="$textOnColor">Long</SizableText></Button>',
      ),
    ),
  ).toHaveLength(1);
  expect(
    checkButtonColors(
      parse(
        'good.tsx',
        '<Button variant="destructive"><SizableText color="$textOnColor">Short</SizableText></Button>',
      ),
    ),
  ).toEqual([]);

  const root = path.resolve(__dirname, '..');
  const failures: string[] = [];
  function scan(directory: string) {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) scan(file);
      else if (file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
        failures.push(
          ...checkButtonColors(parse(file, fs.readFileSync(file, 'utf8'))),
        );
      }
    }
  }
  scan(root);
  expect(failures).toEqual([]);
});
