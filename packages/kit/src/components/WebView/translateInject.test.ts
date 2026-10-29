/** @jest-environment jsdom */

type ITranslateInjectApi = {
  start: (lang: string, mode: string, session: string) => void;
  stop: () => void;
};

type ITranslateRequest = {
  type: string;
  id: string;
  sessionId: string;
  texts: string[];
};

const BATCH_DELAY_MS = 200;

const postMessage = jest.fn();
let translator: ITranslateInjectApi | undefined;

// The script is an IIFE that guards itself per page; each test loads a fresh
// copy, as a newly loaded document would.
function loadScript(): ITranslateInjectApi {
  const page = globalThis as unknown as {
    __onekeyTranslateInitialized?: boolean;
    __onekeyTranslate: ITranslateInjectApi;
  };
  delete page.__onekeyTranslateInitialized;
  jest.isolateModules(() => {
    jest.requireActual('./translateInject');
  });
  translator = page.__onekeyTranslate;
  return translator;
}

function sentRequests(): ITranslateRequest[] {
  return postMessage.mock.calls
    .map(([data]) => JSON.parse(data as string) as ITranslateRequest)
    .filter((message) => message.type === '$$ONEKEY_TRANSLATE_REQUEST');
}

function respond(message: {
  id: string;
  sessionId: string;
  translations?: string[];
  abort?: boolean;
}) {
  globalThis.dispatchEvent(
    new MessageEvent('message', {
      data: JSON.stringify({ type: '$$ONEKEY_TRANSLATE_RESPONSE', ...message }),
    }),
  );
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe('translateInject sessions', () => {
  let textNode: Node;
  // jest-setup.js stubs the global addEventListener; the script needs the
  // page's own one to receive the app's responses.
  const stubbedAddEventListener = globalThis.addEventListener;

  beforeAll(() => {
    delete (globalThis as unknown as { addEventListener?: unknown })
      .addEventListener;
  });

  afterAll(() => {
    globalThis.addEventListener = stubbedAddEventListener;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    postMessage.mockReset();
    (
      globalThis as unknown as { ReactNativeWebView: unknown }
    ).ReactNativeWebView = { postMessage };
    document.body.innerHTML = '<p id="text">Hello world</p>';
    textNode = document.getElementById('text')?.firstChild as Node;
  });

  afterEach(() => {
    // Keeps the observers of this copy off the next test's document.
    translator?.stop();
    translator = undefined;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('writes back a request sent before the page followed a new session', async () => {
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const [request] = sentRequests();
    expect(request).toMatchObject({
      sessionId: 'session-a',
      texts: ['Hello world'],
    });

    // The app took the load end and started another session on this document.
    translate.start('zh', 'replace', 'session-b');
    respond({
      id: request.id,
      sessionId: 'session-a',
      translations: ['你好世界'],
    });
    await flushMicrotasks();

    expect(textNode.nodeValue).toBe('你好世界');
  });

  it('sends the requests after the switch with the new session', () => {
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    translate.start('zh', 'replace', 'session-b');
    jest.advanceTimersByTime(BATCH_DELAY_MS);

    expect(sentRequests()).toEqual([
      expect.objectContaining({ sessionId: 'session-b' }),
    ]);
  });

  it('drops a response of a stopped session', async () => {
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const [request] = sentRequests();

    translate.stop();
    respond({
      id: request.id,
      sessionId: 'session-a',
      translations: ['你好世界'],
    });
    await flushMicrotasks();

    expect(textNode.nodeValue).toBe('Hello world');
  });

  it('drops a response whose session does not match the request', async () => {
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const [request] = sentRequests();

    respond({
      id: request.id,
      sessionId: 'session-of-another-document',
      translations: ['你好世界'],
    });
    await flushMicrotasks();

    expect(textNode.nodeValue).toBe('Hello world');
  });

  it('clears an aborted batch without caching its original text as a translation', async () => {
    // jsdom lacks constructable stylesheet updates used by the spinner.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync = jest.fn();
    jest.spyOn(globalThis, 'CSSStyleSheet').mockReturnValue(sheet);
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const [request] = sentRequests();
    expect(
      document.querySelector('[data-onekey-translate-loading]'),
    ).not.toBeNull();

    respond({ id: request.id, sessionId: 'session-a', abort: true });
    await flushMicrotasks();
    expect(textNode.nodeValue).toBe('Hello world');
    expect(
      document.querySelector('[data-onekey-translate-loading]'),
    ).toBeNull();

    // Following a new sid preserves the document cache. The same text in
    // newly added DOM must still reach the API after the earlier abort.
    translate.start('zh', 'replace', 'session-b');
    const addedText = document.createTextNode('Hello world');
    document.getElementById('text')?.appendChild(addedText);
    await flushMicrotasks();
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const nextRequest = sentRequests()[1];
    expect(nextRequest).toMatchObject({
      sessionId: 'session-b',
      texts: ['Hello world'],
    });
    respond({
      id: nextRequest.id,
      sessionId: 'session-b',
      translations: ['你好世界'],
    });
    await flushMicrotasks();
    expect(addedText.nodeValue).toBe('你好世界');
  });

  it('ignores an abort with a mismatched sid and still accepts the billed answer', async () => {
    const translate = loadScript();
    translate.start('zh', 'replace', 'session-a');
    jest.advanceTimersByTime(BATCH_DELAY_MS);
    const [request] = sentRequests();
    respond({ id: request.id, sessionId: 'session-b', abort: true });
    respond({
      id: request.id,
      sessionId: 'session-a',
      translations: ['你好世界'],
    });
    await flushMicrotasks();
    expect(textNode.nodeValue).toBe('你好世界');
  });
});
