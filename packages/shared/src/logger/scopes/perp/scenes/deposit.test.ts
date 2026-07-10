import { PerpDepositScene } from './deposit';

import type { IMethodDecoratorMetadata } from '../../../types';

class TestPerpDepositScene extends PerpDepositScene {
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
    this.emissions.push({ methodName, args, metadataList });
  }
}

describe('PerpDepositScene minimum diagnostics', () => {
  it('removes the deduplication key and skips duplicate events', () => {
    const scene = new TestPerpDepositScene();
    const params = {
      dedupKey: 'main:validation:1',
      runtime: 'main' as const,
      phase: 'validation' as const,
      inputAmount: '2',
      passesMinimum: false,
    };

    scene.perpDepositMinimumDiagnostic(params);
    scene.perpDepositMinimumDiagnostic(params);

    expect(scene.emissions).toHaveLength(1);
    expect(scene.emissions[0].args).toEqual([
      {
        runtime: 'main',
        phase: 'validation',
        inputAmount: '2',
        passesMinimum: false,
      },
    ]);
  });
});
