import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';

const EAGER_HARDWARE_SERVICE_FILES = [
  'ServiceHardware.ts',
  'DeviceSettingsManager.ts',
] as const;

describe('hardware JPEG startup graph', () => {
  test.each(EAGER_HARDWARE_SERVICE_FILES)(
    '%s does not eagerly import the JPEG decoder',
    (fileName) => {
      const sourcePath = path.resolve(__dirname, fileName);
      const sourceFile = parse(fs.readFileSync(sourcePath, 'utf8'), {
        sourceFilename: sourcePath,
        sourceType: 'module',
        plugins: ['decorators-legacy', 'typescript'],
      });
      const eagerImports = sourceFile.program.body
        .filter(
          (statement) =>
            statement.type === 'ImportDeclaration' &&
            statement.source.value === './jpegRgbaUtils',
        )
        .map((statement) => `${fileName}:${statement.loc?.start.line ?? 0}`);

      expect(eagerImports).toEqual([]);
    },
  );
});
