import { BaseScene } from './baseScene';
import { LogToConsole, LogToLocal } from './decorators';

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
});
