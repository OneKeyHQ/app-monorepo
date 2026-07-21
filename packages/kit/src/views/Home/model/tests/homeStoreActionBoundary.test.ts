import fs from 'fs';
import path from 'path';

import type { useHomeStoreIntentActions } from '@onekeyhq/kit/src/states/jotai/contexts/home';

const homeRoot = path.resolve(__dirname, '../..');
const kitSrcRoot = path.resolve(homeRoot, '../..');
const homeContextRoot = path.join(kitSrcRoot, 'states/jotai/contexts/home');
const publicIntentActionKeys: Record<
  keyof ReturnType<typeof useHomeStoreIntentActions>['current'],
  true
> = {
  dispatchHomeIntent: true,
};

function listTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(entryPath);
    }
    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('Home Store action boundary', () => {
  it('exports only the typed intent dispatcher from the public Home context', () => {
    const publicIndex = fs.readFileSync(
      path.join(homeContextRoot, 'index.ts'),
      'utf8',
    );

    expect(publicIndex).toContain('useHomeStoreIntentActions');
    expect(publicIndex).not.toContain('useHomeStoreInternalActions');
    expect(publicIndex).not.toContain('dispatchHomeEvent');
    expect(publicIndex).not.toContain('readHomeStoreSnapshot');
    expect(Object.keys(publicIntentActionKeys)).toEqual(['dispatchHomeIntent']);
  });

  it('limits the generic dispatcher to controller/source internals and its atomic test', () => {
    const internalActionsImport = ['contexts/home', 'actions'].join('/');
    const consumers = listTypeScriptFiles(kitSrcRoot)
      .filter((filePath) => filePath !== __filename)
      .filter((filePath) =>
        fs.readFileSync(filePath, 'utf8').includes(internalActionsImport),
      )
      .map((filePath) => path.relative(kitSrcRoot, filePath))
      .toSorted();

    expect(consumers).toEqual([
      'views/Home/model/react/useHomeStoreControllerActions.ts',
      'views/Home/model/react/useHomeStoreSourcePublisher.ts',
      'views/Home/model/store/__tests__/homeStoreAtomicCommit.test.tsx',
    ]);
  });

  it('keeps direct generic dispatch out of Home renderers', () => {
    const allowedDirectDispatchers = new Set([
      path.join(homeRoot, 'model/react/useHomeStoreControllerActions.ts'),
      path.join(homeRoot, 'model/react/useHomeStoreSourcePublisher.ts'),
      path.join(
        homeRoot,
        'model/store/__tests__/homeStoreAtomicCommit.test.tsx',
      ),
    ]);
    const directDispatchConsumers = listTypeScriptFiles(homeRoot)
      .filter((filePath) => filePath !== __filename)
      .filter((filePath) => !/\.test\.tsx?$/.test(filePath))
      .filter((filePath) => !allowedDirectDispatchers.has(filePath))
      .filter((filePath) =>
        fs.readFileSync(filePath, 'utf8').includes('dispatchHomeEvent'),
      )
      .map((filePath) => path.relative(homeRoot, filePath));

    expect(directDispatchConsumers).toEqual([]);
  });
});
