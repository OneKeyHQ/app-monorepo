import { prepareLoggerExport } from './exportSupport';
import utils from './utils';

jest.mock('./utils', () => ({
  __esModule: true,
  default: {
    flushPendingRepeat: jest.fn(),
  },
}));

describe('prepareLoggerExport', () => {
  it('flushes pending repeat state before exporting logs', async () => {
    await prepareLoggerExport();

    expect(utils.flushPendingRepeat).toHaveBeenCalledTimes(1);
  });
});
