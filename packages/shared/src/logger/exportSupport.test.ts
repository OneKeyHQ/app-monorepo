import utils from './utils';
import { prepareLoggerExport } from './exportSupport';

jest.mock('./utils', () => ({
  __esModule: true,
  default: {
    flushPendingRepeat: jest.fn(),
  },
}));

describe('prepareLoggerExport', () => {
  it('flushes pending repeat state before exporting logs', () => {
    prepareLoggerExport();

    expect(utils.flushPendingRepeat).toHaveBeenCalledTimes(1);
  });
});
