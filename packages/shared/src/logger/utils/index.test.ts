import utils from '.';

import appGlobals from '../../appGlobals';

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: { $backgroundApiProxy: { serviceLogger: { addMsg: jest.fn() } } },
}));
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: { isDev: false },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));

describe('web/extension log export deduplication', () => {
  const addMsg = jest.spyOn(
    appGlobals.$backgroundApiProxy.serviceLogger,
    'addMsg',
  );

  beforeEach(async () => {
    await utils.flushPendingRepeat();
    addMsg.mockReset();
    addMsg.mockResolvedValue(true);
  });

  it('does not duplicate the old summary or lose new repeats while export awaits storage', async () => {
    utils.consoleFunc('old');
    utils.consoleFunc('old');
    let finish: (value: boolean) => void = () => {};
    addMsg.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const exporting = utils.flushPendingRepeat();
    utils.consoleFunc('new');
    utils.consoleFunc('new');
    utils.consoleFunc('new');
    finish(true);
    await exporting;
    await utils.flushPendingRepeat();
    expect(addMsg.mock.calls.map(([message]) => message)).toEqual([
      'old\r\n',
      '[1 repeat]\r\n',
      'new\r\n',
      '[2 repeat]\r\n',
    ]);
  });
});
