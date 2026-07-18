import { OneKeyLocalError } from '../errors';

import { reportPerformanceTerminal } from './terminalReporter';

const homePerfReadyMock = jest.fn();

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      performanceJourney: {
        homePerfReady: (...args: unknown[]) => {
          homePerfReadyMock(...args);
        },
      },
    },
  },
}));

describe('reportPerformanceTerminal', () => {
  beforeEach(() => {
    homePerfReadyMock.mockReset();
  });

  it('forwards the payload unchanged', () => {
    const input = {
      scenario: 'cold',
      renderer: 'legacy',
      result: 'success',
      durationMs: 400,
      sampleRate: 0.1,
    };
    const payload = reportPerformanceTerminal('homePerfReady', input);

    expect(payload).toBe(input);
    expect(homePerfReadyMock).toHaveBeenCalledWith(input);
  });

  it('isolates logger failures from the caller', () => {
    homePerfReadyMock.mockImplementationOnce(() => {
      throw new OneKeyLocalError('logger failed');
    });

    expect(() =>
      reportPerformanceTerminal('homePerfReady', {
        result: 'error',
        durationMs: 1,
        sampleRate: 1,
      }),
    ).not.toThrow();
  });
});
