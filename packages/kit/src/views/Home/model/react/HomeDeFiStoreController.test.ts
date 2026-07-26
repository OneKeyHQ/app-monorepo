import fs from 'fs';
import path from 'path';

const controllerSource = fs.readFileSync(
  path.join(__dirname, 'HomeDeFiStoreController.tsx'),
  'utf8',
);
const sourceHook = fs.readFileSync(
  path.join(__dirname, 'useHomeDeFiStoreSource.ts'),
  'utf8',
);

describe('HomeDeFiStoreController activation', () => {
  it('separates source applicability from tab visibility', () => {
    expect(controllerSource).toContain('const enabled =');
    expect(controllerSource).toContain('const fetchActive =');
    expect(controllerSource).toContain('enabled,');
    expect(controllerSource).toContain('visible: fetchActive');
  });

  it('loads single-network data before the DeFi tab becomes visible', () => {
    const initialLoadEffect = sourceHook.slice(
      sourceHook.indexOf('requestIdRef.current += 1;'),
      sourceHook.indexOf('const actionRefreshTargetRef'),
    );

    expect(initialLoadEffect).toContain('void loadSingle(false);');
    expect(initialLoadEffect).not.toContain('!visible');
    expect(sourceHook).toContain('if (!fullSourceEnabled || !visible)');
  });
});
