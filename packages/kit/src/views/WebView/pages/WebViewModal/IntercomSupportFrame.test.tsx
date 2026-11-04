/** @jest-environment jsdom */

import { act, cleanup, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { IntercomSupportFrame } from './IntercomSupportFrame';

const mockGetToken = jest.fn<Promise<string | undefined>, [string | null]>();

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/identity', () => ({
  getIntercomSessionToken: (userId: string | null) => mockGetToken(userId),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const origin = 'https://intercom.onekey.so';
const url = `${origin}/#bridge=message-channel-v1`;
const handshake = { type: 'onekey-intercom-bridge', version: 1 };

// jsdom does not implement MessageChannel; the hosted page's side is covered
// with real ports in app-webview-pages.
class TestPort implements MessagePort {
  onmessage: MessagePort['onmessage'] = null;

  onmessageerror: MessagePort['onmessageerror'] = null;

  close = jest.fn();

  start = jest.fn();

  postMessage = jest.fn();

  addEventListener = jest.fn();

  removeEventListener = jest.fn();

  dispatchEvent = jest.fn(() => true);
}

function getFrame() {
  return screen.getByTestId('intercom-support-frame') as HTMLIFrameElement;
}

function sendHandshake(options: MessageEventInit<unknown> = {}) {
  const port = new TestPort();
  act(() => {
    globalThis.window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        source: getFrame().contentWindow,
        data: handshake,
        ports: [port],
        ...options,
      }),
    );
  });
  return port;
}

const flush = () =>
  act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });

beforeEach(() => {
  mockGetToken.mockReset();
  mockGetToken.mockResolvedValue('intercom-token');
  // The shared Jest setup replaces listeners; restore DOM dispatch here.
  const eventTarget: EventTarget = globalThis.window;
  jest
    .spyOn(eventTarget, 'addEventListener')
    .mockImplementation((type, listener, options) => {
      EventTarget.prototype.addEventListener.call(
        eventTarget,
        type,
        listener,
        options,
      );
    });
  jest
    .spyOn(eventTarget, 'removeEventListener')
    .mockImplementation((type, listener, options) => {
      EventTarget.prototype.removeEventListener.call(
        eventTarget,
        type,
        listener,
        options,
      );
    });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test('loads the support URL in a frame that cannot navigate the wallet', () => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  expect(getFrame().getAttribute('src')).toBe(url);
  const sandbox = getFrame().getAttribute('sandbox') ?? '';
  expect(sandbox).toContain('allow-scripts');
  expect(sandbox).toContain('allow-same-origin');
  expect(sandbox).not.toContain('allow-top-navigation');
});

test('labels the frame with the translated support title', () => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  expect(getFrame().getAttribute('title')).toBe(
    ETranslations.settings_contact_us,
  );
});

test('answers a verified handshake on the port of that document', async () => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  const port = sendHandshake();
  await flush();
  expect(mockGetToken).toHaveBeenCalledWith('A');
  expect(port.postMessage).toHaveBeenCalledWith({
    type: 'onekey-intercom-session',
    version: 1,
    token: 'intercom-token',
  });
  expect(port.close).toHaveBeenCalled();
});

test('tells the page explicitly when support is anonymous', async () => {
  mockGetToken.mockResolvedValue(undefined);
  render(<IntercomSupportFrame url={url} userId={null} />);
  const port = sendHandshake();
  await flush();
  expect(port.postMessage).toHaveBeenCalledWith({
    type: 'onekey-intercom-session',
    version: 1,
  });
});

test.each([
  ['another origin', { origin: 'https://evil.test' }],
  ['another window', { source: globalThis.window }],
  ['no port', { ports: [] }],
  ['a malformed handshake', { data: { type: 'other', version: 1 } }],
])('ignores a handshake from %s', async (_name, options) => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  const port = sendHandshake(options);
  await flush();
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(port.postMessage).not.toHaveBeenCalled();
});

test('ignores a handshake carrying more than one port', async () => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  const first = new TestPort();
  sendHandshake({ ports: [first, new TestPort()] });
  await flush();
  expect(mockGetToken).not.toHaveBeenCalled();
  expect(first.postMessage).not.toHaveBeenCalled();
});

test('never delivers after the frame unmounts', async () => {
  let resolveToken: (token: string) => void = () => {};
  mockGetToken.mockReturnValue(
    new Promise((resolve) => {
      resolveToken = resolve;
    }),
  );
  const { unmount } = render(<IntercomSupportFrame url={url} userId="A" />);
  const port = sendHandshake();
  unmount();
  resolveToken('intercom-token');
  await flush();
  expect(port.postMessage).not.toHaveBeenCalled();
  expect(port.close).toHaveBeenCalled();
});

test('sends nothing when the token cannot be loaded', async () => {
  mockGetToken.mockRejectedValue(new Error('network'));
  render(<IntercomSupportFrame url={url} userId="A" />);
  const port = sendHandshake();
  await flush();
  expect(port.postMessage).not.toHaveBeenCalled();
  expect(port.close).toHaveBeenCalled();
});

test('fetches a fresh token for each document in the frame', async () => {
  render(<IntercomSupportFrame url={url} userId="A" />);
  sendHandshake();
  await flush();
  const reloaded = sendHandshake();
  await flush();
  expect(mockGetToken).toHaveBeenCalledTimes(2);
  expect(reloaded.postMessage).toHaveBeenCalledTimes(1);
});
