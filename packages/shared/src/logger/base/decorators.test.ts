import { BaseScene } from './baseScene';
import { LogToConsole, LogToLocal, LogToServer } from './decorators';

import type { IMethodDecoratorMetadata } from '../types';

class NestedCallTestScene extends BaseScene {
  emissions: Array<{
    methodName: string;
    args: unknown[];
    metadataList: IMethodDecoratorMetadata[];
  }> = [];

  override _emitLog(
    methodName: string,
    args: unknown[],
    metadataList: IMethodDecoratorMetadata[],
  ) {
    this.emissions.push({
      methodName,
      args,
      metadataList,
    });
  }

  @LogToLocal()
  methodA() {
    this.methodB();
    return ['fromA'];
  }

  @LogToConsole()
  methodB() {
    return ['fromB'];
  }

  @LogToServer()
  @LogToLocal()
  emptyBodyEvent() {}

  @LogToLocal()
  singleDecoratorEmpty() {}
}

describe('logger decorators', () => {
  it('keeps nested decorated method calls isolated per method invocation', () => {
    const scene = new NestedCallTestScene();

    scene.methodA();

    expect(scene.emissions).toEqual([
      {
        methodName: 'methodB',
        args: ['fromB'],
        metadataList: [{ level: 'info', type: 'console' }],
      },
      {
        methodName: 'methodA',
        args: ['fromA'],
        metadataList: [{ level: 'info', type: 'local' }],
      },
    ]);
  });

  it('emits payload-less events whose method body has no return statement', () => {
    // Regression guard for #10959: empty-body methods such as `appStart()` were
    // being silently dropped because the decorator treated `result === undefined`
    // as a skip signal even when wrapping the user's actual method.
    const scene = new NestedCallTestScene();

    scene.emptyBodyEvent();
    scene.singleDecoratorEmpty();

    expect(scene.emissions).toEqual([
      {
        methodName: 'emptyBodyEvent',
        args: [undefined],
        metadataList: [
          { level: 'info', type: 'local' },
          { level: 'info', type: 'server' },
        ],
      },
      {
        methodName: 'singleDecoratorEmpty',
        args: [undefined],
        metadataList: [{ level: 'info', type: 'local' }],
      },
    ]);
  });
});
