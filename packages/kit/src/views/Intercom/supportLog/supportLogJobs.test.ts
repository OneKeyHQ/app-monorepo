import type * as ISupportLogJobs from './supportLogJobs';

const mockUploads: {
  resolve: (objectKey: string) => void;
  reject: (error: unknown) => void;
}[] = [];
const mockSession = {
  getConversation: jest.fn(),
  reply: jest.fn(),
};

jest.mock('@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs', () => ({
  collectLogDigest: jest.fn(async () => ({ sizeBytes: 2048 })),
  disposeLogDigest: jest.fn(async () => undefined),
}));
jest.mock('@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/utils', () => ({
  buildDefaultFileBaseName: () => 'OneKeyLogs',
}));
jest.mock(
  '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/uploadLogsWithRetry',
  () => ({
    uploadLogsWithRetry: async ({
      collectDigest,
    }: {
      collectDigest: () => Promise<unknown>;
    }) => {
      await collectDigest();
      return new Promise<string>((resolve, reject) => {
        mockUploads.push({ resolve, reject });
      });
    },
    isLogUploadRateLimitError: (error: { code?: number }) =>
      error?.code === 12_001,
  }),
);
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/intercom/messengerModels',
  () => ({
    intercomMessageBlocks: (text: string) => [{ type: 'paragraph', text }],
  }),
);
jest.mock('../client', () => ({
  createIntercomMessengerSession: async () => mockSession,
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('support log jobs', () => {
  let store: typeof ISupportLogJobs;
  beforeEach(() => {
    mockUploads.length = 0;
    mockSession.getConversation.mockReset().mockResolvedValue({ parts: [] });
    mockSession.reply.mockReset().mockResolvedValue({ id: 'part' });
    jest.isolateModules(() => {
      store = jest.requireActual<typeof ISupportLogJobs>('./supportLogJobs');
    });
  });

  const sentMessage = () =>
    mockSession.reply.mock.calls[0][1] as {
      clientId: string;
      blocks: { text: string }[];
    };

  test.each([
    ['the upload finishes first', true],
    ['the conversation is created first', false],
  ])(
    'sends the log ID once both are ready when %s',
    async (_name, uploadFirst) => {
      const id = store.startSupportLogUpload({
        ownerUserId: 'user',
        messageTitle: 'Diagnostic logs attached',
      });
      await flush();
      expect(store.getSupportLogJob(id)?.stage).toBe('uploading');
      if (uploadFirst) {
        mockUploads[0].resolve('client-logs/a.zip');
        await flush();
        expect(store.getSupportLogJob(id)?.stage).toBe('ready');
        expect(mockSession.reply).not.toHaveBeenCalled();
        store.bindSupportLogConversation(id, '42');
      } else {
        store.bindSupportLogConversation(id, '42');
        await flush();
        expect(mockSession.reply).not.toHaveBeenCalled();
        mockUploads[0].resolve('client-logs/a.zip');
      }
      await flush();
      expect(mockSession.reply).toHaveBeenCalledTimes(1);
      expect(mockSession.reply.mock.calls[0][0]).toBe('42');
      expect(sentMessage().blocks[0].text).toBe(
        'Diagnostic logs attached\nLog ID: client-logs/a.zip',
      );
      expect(store.getSupportLogJob(id)?.stage).toBe('sent');
    },
  );

  test('a retry after an uncertain send does not post the ID twice', async () => {
    const id = store.startSupportLogUpload({
      ownerUserId: 'user',
      conversationId: '42',
      messageTitle: 'Diagnostic logs attached',
    });
    await flush();
    mockSession.reply.mockRejectedValueOnce(new Error('timeout'));
    mockUploads[0].resolve('client-logs/a.zip');
    await flush();
    expect(store.getSupportLogJob(id)?.stage).toBe('sendFailed');

    // The timed-out reply had landed after all.
    mockSession.getConversation.mockResolvedValue({
      parts: [{ clientId: sentMessage().clientId }],
    });
    store.retrySupportLog(id);
    await flush();
    expect(mockSession.reply).toHaveBeenCalledTimes(1);
    expect(store.getSupportLogJob(id)?.stage).toBe('sent');
  });

  test('a rate-limited upload can be retried with a fresh upload', async () => {
    const id = store.startSupportLogUpload({
      ownerUserId: 'user',
      conversationId: '42',
      messageTitle: 'Diagnostic logs attached',
    });
    await flush();
    mockUploads[0].reject({ code: 12_001 });
    await flush();
    expect(store.getSupportLogJob(id)?.stage).toBe('rateLimited');

    store.retrySupportLog(id);
    await flush();
    mockUploads[1].resolve('client-logs/b.zip');
    await flush();
    expect(store.getSupportLogJob(id)?.stage).toBe('sent');
    expect(sentMessage().blocks[0].text).toContain('client-logs/b.zip');
  });

  test('a cancelled upload never sends its ID', async () => {
    const id = store.startSupportLogUpload({
      ownerUserId: 'user',
      conversationId: '42',
      messageTitle: 'Diagnostic logs attached',
    });
    await flush();
    store.removeSupportLog(id);
    mockUploads[0].resolve('client-logs/a.zip');
    await flush();
    expect(store.getSupportLogJob(id)).toBeUndefined();
    expect(mockSession.reply).not.toHaveBeenCalled();
  });
});
