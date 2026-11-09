import { AccountSelectorScope } from '.';

import { AccountSelectorAutoSelectScene } from './scenes/autoSelect';
import { AccountSelectorFailureScene } from './scenes/failure';
import { AccountSelectorListDataScene } from './scenes/listData';
import { AccountSelectorPerfScene } from './scenes/perf';
import { AccountSelectorRenderScene } from './scenes/render';
import { AccountSelectorStaleDropScene } from './scenes/staleDrop';
import { AccountSelectorStorageScene } from './scenes/storage';

describe('account selector logger build boundaries', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalE2EMode = process.env.E2E_MODE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalE2EMode === undefined) {
      delete process.env.E2E_MODE;
    } else {
      process.env.E2E_MODE = originalE2EMode;
    }
  });

  it('keeps production-only no-op facades without instantiating development scenes', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.E2E_MODE;
    const scope = new AccountSelectorScope();

    expect(scope.perf).not.toBeInstanceOf(AccountSelectorPerfScene);
    expect(scope.render).not.toBeInstanceOf(AccountSelectorRenderScene);
    expect(scope.storage).not.toBeInstanceOf(AccountSelectorStorageScene);
    expect(scope.autoSelect).not.toBeInstanceOf(AccountSelectorAutoSelectScene);
    expect(
      scope.perf.trace('selectionStateUpdated', { num: 0 }),
    ).toBeUndefined();
    expect(scope.perf.consoleLog('ignored')).toBeUndefined();
    expect(scope.perf.scopeName).toBe('accountSelector');
    expect(scope.perf.sceneName).toBe('perf');
    expect(await Promise.resolve(scope.perf)).toBe(scope.perf);
    expect(scope.perf.consoleError('ignored')).toEqual(['ignored']);
    expect(scope.storage.consoleLog('ignored')).toEqual(['ignored']);
    expect(scope.storage._currentCallMetadataStack).toBeUndefined();

    expect(scope.failure).toBeInstanceOf(AccountSelectorFailureScene);
    expect(scope.staleDrop).toBeInstanceOf(AccountSelectorStaleDropScene);
    expect(scope.listData).toBeInstanceOf(AccountSelectorListDataScene);
  });

  it.each([
    ['development', ''],
    ['production', 'true'],
  ] as const)(
    'retains the real scenes for NODE_ENV=%s E2E_MODE=%s',
    (nodeEnv, e2eMode) => {
      process.env.NODE_ENV = nodeEnv;
      process.env.E2E_MODE = e2eMode;
      const scope = new AccountSelectorScope();
      expect(scope.perf).toBeInstanceOf(AccountSelectorPerfScene);
      expect(scope.render).toBeInstanceOf(AccountSelectorRenderScene);
      expect(scope.storage).toBeInstanceOf(AccountSelectorStorageScene);
      expect(scope.autoSelect).toBeInstanceOf(AccountSelectorAutoSelectScene);
    },
  );
});
