import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AccountRenameButton native sheet ordering', () => {
  const source = readFileSync(
    join(__dirname, 'AccountRenameButton.tsx'),
    'utf8',
  );

  it('keeps the parent ActionList open when the Rename Dialog closes', () => {
    expect(source).toContain('nativeSheet,');
    expect(source).toContain('(_close: () => void) =>');
    expect(source).not.toContain('onClose: onDialogClose');
    expect(source).not.toContain('onDialogClose:');
    expect(source).not.toContain('AccountRenameNativeSheet');
  });
});
