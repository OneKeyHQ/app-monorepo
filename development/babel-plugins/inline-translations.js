/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

const TRANSLATION_IMPORT_SOURCES = new Set([
  '@onekeyhq/shared/src/locale',
  '@onekeyhq/shared/src/locale/index',
  '@onekeyhq/shared/src/locale/enum/translations',
]);

let cachedTranslationMap;

function getTranslationMap() {
  if (cachedTranslationMap) {
    return cachedTranslationMap;
  }

  const translationsPath = path.resolve(
    __dirname,
    '../../packages/shared/src/locale/enum/translations.ts',
  );
  const source = fs.readFileSync(translationsPath, 'utf8');
  const map = new Map();
  const enumItemRegex = /^\s*([A-Za-z0-9_$]+)\s*=\s*'([^']*)',?\s*$/gm;
  let match = enumItemRegex.exec(source);
  while (match) {
    map.set(match[1], match[2]);
    match = enumItemRegex.exec(source);
  }

  cachedTranslationMap = map;
  return map;
}

function getStaticMemberName(pathNode) {
  const { node } = pathNode;
  if (node.computed) {
    if (pathNode.get('property').isStringLiteral()) {
      return node.property.value;
    }
    return undefined;
  }
  if (pathNode.get('property').isIdentifier()) {
    return node.property.name;
  }
  return undefined;
}

function isTranslationImportSource(source, filename) {
  if (TRANSLATION_IMPORT_SOURCES.has(source)) {
    return true;
  }
  if (!source.startsWith('.')) {
    return false;
  }

  const importerDir = filename ? path.dirname(filename) : process.cwd();
  const resolved = path.resolve(importerDir, source);
  const normalized = resolved.split(path.sep).join('/');
  return (
    normalized.endsWith('/packages/shared/src/locale') ||
    normalized.endsWith('/packages/shared/src/locale/index') ||
    normalized.endsWith('/packages/shared/src/locale/enum/translations')
  );
}

module.exports = function inlineTranslationsPlugin({ types: t }) {
  const translations = getTranslationMap();

  return {
    name: 'onekey-inline-translations',
    visitor: {
      Program(programPath) {
        const localNames = new Set();
        const importSpecifiers = [];
        const importDeclarationsToCleanup = new WeakSet();

        programPath.get('body').forEach((statementPath) => {
          if (!statementPath.isImportDeclaration()) {
            return;
          }
          if (
            !isTranslationImportSource(
              statementPath.node.source.value,
              programPath.hub.file.opts.filename,
            )
          ) {
            return;
          }
          if (statementPath.node.importKind === 'type') {
            return;
          }

          statementPath.get('specifiers').forEach((specifierPath) => {
            if (!specifierPath.isImportSpecifier()) {
              return;
            }
            const imported = specifierPath.get('imported');
            if (!imported.isIdentifier({ name: 'ETranslations' })) {
              return;
            }
            localNames.add(specifierPath.node.local.name);
            importSpecifiers.push(specifierPath);
            importDeclarationsToCleanup.add(statementPath.node);
          });
        });

        if (!localNames.size) {
          return;
        }

        programPath.traverse({
          MemberExpression(memberPath) {
            const objectPath = memberPath.get('object');
            if (!objectPath.isIdentifier()) {
              return;
            }
            if (!localNames.has(objectPath.node.name)) {
              return;
            }
            const memberName = getStaticMemberName(memberPath);
            const translationKey = memberName
              ? translations.get(memberName)
              : undefined;
            if (!translationKey) {
              return;
            }
            memberPath.replaceWith(t.stringLiteral(translationKey));
          },
        });

        programPath.scope.crawl();

        for (const specifierPath of importSpecifiers) {
          const binding = programPath.scope.getBinding(
            specifierPath.node.local.name,
          );
          if (!binding || binding.referencePaths.length === 0) {
            specifierPath.remove();
          }
        }

        programPath.get('body').forEach((statementPath) => {
          if (
            statementPath.isImportDeclaration() &&
            importDeclarationsToCleanup.has(statementPath.node) &&
            statementPath.node.specifiers.length === 0
          ) {
            statementPath.remove();
          }
        });
      },
    },
  };
};
