import { getRequestHeaders } from './Interceptor';

// requestHelper stays unmocked: it is the stub a runtime that never calls
// overrideMethods() keeps, such as the extension offscreen document.

jest.mock('./availabilityAggregator', () => ({
  recordAvailabilityOutcome: jest.fn(),
}));

jest.mock('./Interceptor', () => ({
  HEADER_REQUEST_ID_KEY: 'x-onekey-request-id',
  getRequestHeaders: jest.fn(async () => ({ 'x-onekey-request-id': 'id' })),
}));

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: { network: { end: jest.fn(), error: jest.fn(), start: jest.fn() } },
  },
}));

jest.mock('../logger/scopes/app/scenes/networkFilter', () => ({
  isEnableLogNetwork: () => false,
}));

jest.mock('../utils/systemTimeUtils', () => ({
  __esModule: true,
  default: { handleServerResponseDate: async () => undefined },
}));

const LEDGER_URL =
  'https://manager.api.live.ledger.com/api/get_device_version?target_id=1';
const stubFetch = jest.fn<Promise<Response>, [unknown, RequestInit?]>();

describe('fetch interceptor in a runtime that never set up requestHelper', () => {
  beforeAll(async () => {
    globalThis.fetch = stubFetch as typeof fetch;
    await import('./fetchInterceptor');
  });

  it('still sends the request, without OneKey headers', async () => {
    stubFetch.mockResolvedValue(new Response('{}'));

    const response = await fetch(LEDGER_URL);

    expect(response.ok).toBe(true);
    expect(stubFetch).toHaveBeenCalledTimes(1);
    expect(stubFetch.mock.calls[0][0]).toBe(LEDGER_URL);
    expect(getRequestHeaders).not.toHaveBeenCalled();
  });
});
