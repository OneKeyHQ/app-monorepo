import { BinanceDepositScene } from './binanceDeposit';

const SECRET = '0123456789abcdefghijklmnopqrstuvwxyzABCDE-_';

const REQUIRED_METHODS = [
  'createStart',
  'createResult',
  'linkOpen',
  'returnReceived',
  'returnDiscarded',
  'bindAttempt',
  'bindResult',
  'queryResult',
  'presignCheck',
  'sendResult',
  'reportAttempt',
  'reportResult',
  'localCleanup',
];

type ISceneMethod = (params: object) => unknown;

function createScene() {
  const scene = new BinanceDepositScene();
  const emitLog = jest
    .spyOn(scene, '_emitLog')
    .mockImplementation(() => undefined);
  const methodNames = Object.getOwnPropertyNames(
    BinanceDepositScene.prototype,
  ).filter((name) => name !== 'constructor');
  const call = (methodName: string, params: object) =>
    (scene as unknown as Record<string, ISceneMethod>)[methodName](params);
  return { scene, emitLog, methodNames, call };
}

describe('BinanceDepositScene', () => {
  it('covers every step of the deposit flow', () => {
    const { methodNames } = createScene();
    expect(methodNames).toEqual(expect.arrayContaining(REQUIRED_METHODS));
  });

  it('writes every step to the local log only', () => {
    const { emitLog, methodNames, call } = createScene();
    for (const methodName of methodNames) {
      call(methodName, { sid: '01234567…', attempt: 1 });
    }

    expect(emitLog).toHaveBeenCalledTimes(methodNames.length);
    for (const [methodName, args, metadataList] of emitLog.mock.calls) {
      expect(methodNames).toContain(methodName);
      expect(args).toEqual([
        expect.objectContaining({ sid: '01234567…', attempt: 1 }),
      ]);
      expect(metadataList).toEqual([
        expect.objectContaining({ type: 'local' }),
      ]);
    }
  });

  it('numbers its lines so identical steps are not folded together', () => {
    const { scene, emitLog } = createScene();
    scene.bindAttempt({ sid: '01234567…', attempt: 1 });
    scene.bindAttempt({ sid: '01234567…', attempt: 1 });

    const [first, second] = emitLog.mock.calls.map(
      ([, args]) => (args[0] as { seq: number }).seq,
    );
    expect(second).toBe(first + 1);
  });

  it('never emits a key-sized string, a URL or an object', () => {
    const { emitLog, methodNames, call } = createScene();
    for (const methodName of methodNames) {
      call(methodName, {
        sid: SECRET,
        reason: SECRET,
        trigger: `onekey-wallet://x?rn=${SECRET}`,
        networkId: 'https://app.binance.com/x',
        otherParamNames: [SECRET, 'status'],
        error: Object.assign(new Error(SECRET), {
          config: { data: SECRET },
        }),
      });
    }

    const emitted = JSON.stringify(emitLog.mock.calls.map(([, args]) => args));
    expect(emitLog).toHaveBeenCalledTimes(methodNames.length);
    expect(emitted).not.toContain(SECRET);
    expect(emitted).not.toContain(SECRET.slice(0, 16));
    expect(emitted).not.toContain('binance.com');
    expect(emitted).not.toContain('onekey-wallet');
    expect(emitted).toContain('status');
  });
});
