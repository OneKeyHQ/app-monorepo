import fs from 'fs';
import path from 'path';

import { parse as parseJson5 } from 'json5';

type IOxlintOverride = {
  files?: string[];
  rules?: {
    'no-restricted-imports'?: [
      string,
      { patterns?: Array<{ group?: string[] }> },
    ];
  };
};

describe('native-components import hierarchy', () => {
  it.each([
    'packages/shared/src/**/*.ts',
    'packages/components/src/**/*.ts',
    'packages/core/src/**/*.ts',
    'packages/kit-bg/src/**/*.ts',
  ])('blocks reverse imports for %s', (filePattern) => {
    const rootDir = path.resolve(__dirname, '../../..');
    const config = parseJson5(
      fs.readFileSync(path.join(rootDir, '.oxlintrc.json'), 'utf8'),
    ) as { overrides: IOxlintOverride[] };
    const override = config.overrides.find((candidate) =>
      candidate.files?.includes(filePattern),
    );
    const restrictedPatterns =
      override?.rules?.['no-restricted-imports']?.[1].patterns ?? [];
    const restrictedImports = restrictedPatterns.flatMap(
      (pattern) => pattern.group ?? [],
    );

    expect(restrictedImports).toEqual(
      expect.arrayContaining([
        '@onekeyhq/native-components',
        '@onekeyhq/native-components/**',
      ]),
    );
  });
});
