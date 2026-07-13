import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

function listSourceFiles(dirPath: string): string[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') {
        files.push(...listSourceFiles(entryPath));
      }
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

describe('secureCache Layer 1 degradation', () => {
  it('only writes session memo entries inside SignerSoftwareBase.getHdCredential', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const matches = listSourceFiles(srcRoot)
      .filter((filePath) =>
        /(?:secureCache|sessionCache)\.set\(/.test(
          readFileSync(filePath, 'utf-8'),
        ),
      )
      .map((filePath) => path.relative(srcRoot, filePath));

    expect(matches).toEqual(['signer/base/SignerSoftwareBase.ts']);

    const signerSource = readFileSync(
      path.join(srcRoot, 'signer/base/SignerSoftwareBase.ts'),
      'utf-8',
    );
    expect(signerSource).toMatch(
      /async getHdCredential\(\): Promise<string> \{[\s\S]*this\.sessionCache\.set\(/,
    );
  });
});
