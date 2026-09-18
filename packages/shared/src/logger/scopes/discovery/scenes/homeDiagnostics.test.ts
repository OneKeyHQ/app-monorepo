import { DiscoveryHomeDiagnosticsScene } from './homeDiagnostics';

describe('DiscoveryHomeDiagnosticsScene', () => {
  it('writes every home diagnostic to the local log only', () => {
    const scene = new DiscoveryHomeDiagnosticsScene();
    const emitLog = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    const methodNames = Object.getOwnPropertyNames(
      DiscoveryHomeDiagnosticsScene.prototype,
    ).filter((name) => name !== 'constructor');

    for (const methodName of methodNames) {
      (scene as unknown as Record<string, (params: object) => unknown>)[
        methodName
      ]({ id: 1 });
    }

    expect(methodNames.length).toBeGreaterThan(0);
    expect(emitLog).toHaveBeenCalledTimes(methodNames.length);
    for (const [methodName, args, metadataList] of emitLog.mock.calls) {
      expect(methodNames).toContain(methodName);
      expect(args).toEqual([{ id: 1 }]);
      expect(metadataList).toEqual([
        expect.objectContaining({ type: 'local' }),
      ]);
    }
  });
});
