import { PrimeTransferScene } from './transfer';

it('writes import diagnostics to local error logs for cloud restore and transfer', () => {
  const scene = new PrimeTransferScene();
  const emitLog = jest
    .spyOn(scene, '_emitLog')
    .mockImplementation(() => undefined);
  for (const flow of ['cloudBackupRestore', 'transfer'] as const) {
    const params = {
      flow,
      taskUUID: 'synthetic-import-task',
      stage: 'importPrivateKeyAccount',
      targetType: 'importedAccount',
      itemIndex: 3,
      networkId: 'btc--0',
      error: 'Encrypted credential is required',
    };
    scene.importError(params);
    expect(emitLog).toHaveBeenLastCalledWith(
      'importError',
      [params],
      [expect.objectContaining({ type: 'local', level: 'error' })],
    );
  }
  expect(emitLog).toHaveBeenCalledTimes(2);
});
