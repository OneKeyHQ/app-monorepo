import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

import type { ClassDeclaration, Node } from '@babel/types';

function getClassDeclaration(node: Node): ClassDeclaration | undefined {
  if (node.type === 'ClassDeclaration') {
    return node;
  }
  if (
    node.type === 'ExportNamedDeclaration' &&
    node.declaration?.type === 'ClassDeclaration'
  ) {
    return node.declaration;
  }
  return undefined;
}

describe('SimpleDb entity async method contract', () => {
  test('keeps every public entity instance method explicitly async', () => {
    const entityDirectory = path.resolve(__dirname, '../entity');
    const sourcePaths = [
      path.resolve(__dirname, 'SimpleDbEntityBase.ts'),
      ...fs
        .readdirSync(entityDirectory)
        .filter(
          (fileName) =>
            /^SimpleDbEntity.+\.ts$/.test(fileName) &&
            !fileName.endsWith('.test.ts'),
        )
        .map((fileName) => path.join(entityDirectory, fileName)),
    ];
    const violations: string[] = [];
    let entityClassCount = 0;

    sourcePaths.forEach((sourcePath) => {
      const sourceFile = parse(fs.readFileSync(sourcePath, 'utf8'), {
        sourceFilename: sourcePath,
        sourceType: 'module',
        plugins: ['decorators-legacy', 'typescript'],
      });

      sourceFile.program.body.forEach((statement) => {
        const classDeclaration = getClassDeclaration(statement);
        if (
          !classDeclaration ||
          !classDeclaration.id?.name.startsWith('SimpleDbEntity')
        ) {
          return;
        }
        entityClassCount += 1;

        classDeclaration.body.body.forEach((member) => {
          if (
            member.type !== 'ClassMethod' ||
            member.kind !== 'method' ||
            member.static ||
            member.accessibility === 'private' ||
            member.accessibility === 'protected' ||
            member.async
          ) {
            return;
          }
          let methodName = '<computed>';
          if (member.key.type === 'Identifier') {
            methodName = member.key.name;
          } else if (member.key.type === 'StringLiteral') {
            methodName = member.key.value;
          }
          violations.push(
            `${path.basename(sourcePath)}:${member.loc?.start.line ?? 0} ${methodName}`,
          );
        });
      });
    });

    expect(entityClassCount).toBe(64);
    expect(violations).toEqual([]);
  });
});
