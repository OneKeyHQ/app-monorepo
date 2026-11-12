import DesktopApiSniRequest from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiSniRequest';
import type { IDesktopApi } from '@onekeyhq/kit-bg/src/desktopApis/instance/IDesktopApi';

import './logger';

jest.mock('electron-log/main', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    hooks: [],
    transports: { file: {} },
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('electron', () => ({ session: { defaultSession: {} } }));

type IFileFormatParams = {
  data: unknown[];
  level: string;
  message: { date: Date; scope?: string };
};

const fileLogger = jest.requireMock<{
  default: {
    warn: jest.Mock<void, [string]>;
    transports: { file: { format: (params: IFileFormatParams) => string[] } };
  };
}>('electron-log/main').default;

function formatForFile(data: unknown[]): string {
  return fileLogger.transports.file
    .format({ data, level: 'info', message: { date: new Date(0) } })
    .join(' ');
}

describe('SNI request IDs through the final file logger', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    ['a'.repeat(64), `${'a'.repeat(32)}-${'a'.repeat(32)}`],
    [`0x${'A'.repeat(64)}`, `0x${'A'.repeat(32)}-${'A'.repeat(32)}`],
    ['c'.repeat(128), Array<string>(4).fill('c'.repeat(32)).join('-')],
    [
      `request-${'a'.repeat(64)}`,
      `request%2D${'a'.repeat(32)}-${'a'.repeat(32)}`,
    ],
    [
      '12345678-1234-1234-1234-123456789abc',
      '12345678-1234-1234-1234-123456789abc',
    ],
  ])(
    'keeps the complete diagnostic ID %s recoverable',
    async (id, displayedId) => {
      const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
      await expect(api.cancelRequest(id)).resolves.toEqual({ success: false });
      const event = fileLogger.warn.mock.calls.at(-1)?.[0];
      expect(event).toContain(`requestId=${displayedId}`);

      const secret = 'b'.repeat(64);
      const output = formatForFile([`${event} secret=${secret}`]);
      expect(output).toContain(`requestId=${displayedId}`);
      expect(output).toContain('secret=[REDACTED]');
      expect(output).not.toContain(secret);
    },
  );

  test('retains the generic logger policy for unformatted IDs and other secrets', () => {
    const hex = 'a'.repeat(64);
    const output = formatForFile([
      `[DesktopApiSniRequest] event=desktop_sni_request_start requestId=${hex}`,
      `Bearer ${'Q'.repeat(32)}`,
    ]);
    expect(output).toContain('requestId=[REDACTED]');
    expect(output).not.toContain(hex);
    expect(output).not.toContain('Q'.repeat(32));
  });

  test('restores mixed IDs exactly and distinguishes different original separator positions', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
    const hex = 'a'.repeat(64);
    const ids = [
      `${'a'.repeat(32)}-${hex}`,
      `${hex}-${'a'.repeat(32)}`,
      `request+%2D-${hex}-`,
    ];
    const outputs: string[] = [];
    for (const id of ids) {
      await api.cancelRequest(id);
      const output = formatForFile([fileLogger.warn.mock.calls.at(-1)?.[0]]);
      const displayed = /requestId=([^ ]+)/.exec(output)?.[1];
      expect(output).toContain('requestIdFormat=hex32');
      expect(displayed).toBeDefined();
      expect(decodeURIComponent((displayed ?? '').replace(/-/g, ''))).toBe(id);
      outputs.push(output);
    }
    expect(outputs[0]).not.toBe(outputs[1]);
  });

  test('distinguishes grouped raw IDs from IDs originally containing separators', async () => {
    const api = new DesktopApiSniRequest({ desktopApi: {} as IDesktopApi });
    const rawId = 'a'.repeat(64);
    const groupedId = `${'a'.repeat(32)}-${'a'.repeat(32)}`;
    await api.cancelRequest(rawId);
    const rawLog = formatForFile([fileLogger.warn.mock.calls.at(-1)?.[0]]);
    await api.cancelRequest(groupedId);
    const groupedLog = formatForFile([fileLogger.warn.mock.calls.at(-1)?.[0]]);

    expect(rawLog).toContain(`requestId=${groupedId} requestIdFormat=hex32`);
    expect(groupedLog).toContain(`requestId=${groupedId}`);
    expect(groupedLog).not.toContain('requestIdFormat=');
    expect(rawLog).not.toBe(groupedLog);

    await api.cancelRequest('12345678-1234-1234-1234-123456789abc');
    expect(fileLogger.warn.mock.calls.at(-1)?.[0]).not.toContain(
      'requestIdFormat=',
    );
  });
});
