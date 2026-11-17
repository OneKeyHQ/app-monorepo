import { OneKeyLocalError } from '../../errors';

import { createMessengerApi } from './messengerApi';
import { parseIntercomOpen } from './messengerModels';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));

it.each(['message-17', '17'])(
  'maps the UI part id %s to the quick-reply wire identity',
  async (partId) => {
    const request = jest.fn(async () => ({ id: 'reply-1', body: [] }));
    const api = createMessengerApi({ request, assertCurrent: async () => {} });
    const part = await api.quickReply('42', {
      clientId: 'stable-send',
      partId,
      replyId: 'option',
      text: 'Test',
    });
    expect(part.id).toBe('reply-1');
    expect(request).toHaveBeenCalledWith('conversations/42/quick_reply', {
      client_assigned_uuid: 'stable-send',
      conversation_part: {
        id: partId === '17' ? '17' : null,
        reply_option: { uuid: 'option', text: 'Test', type: 'quick_reply' },
      },
    });
  },
);

it('acknowledges read state only after the server accepts it', async () => {
  const request = jest.fn(async (): Promise<unknown> => {
    throw new OneKeyLocalError('offline');
  });
  const onRead = jest.fn<void, [string]>();
  const api = createMessengerApi({
    request,
    onRead,
    assertCurrent: async () => {},
  });
  await expect(api.markRead('42')).rejects.toThrow('offline');
  expect(onRead).not.toHaveBeenCalled();
  request.mockResolvedValue({});
  await api.markRead('42');
  expect(onRead).toHaveBeenCalledWith('42');
});

it('keeps create context and bot-trigger payloads inside the protocol API', async () => {
  const request = jest.fn(async () => ({ id: '42', conversation_parts: [] }));
  const api = createMessengerApi({ request, assertCurrent: async () => {} });
  const open = parseIntercomOpen({
    new_conversation: { cta: { text: 'Send' } },
    request_id: 'open-context',
    bot_intro_id: 'intro',
  });
  const message = {
    clientId: 'stable-id',
    createdAt: 123,
    blocks: [{ type: 'paragraph', text: 'Test' }],
  };
  await api.createConversation({ open, message });
  expect(request).toHaveBeenLastCalledWith('messages', {
    messenger_open_request_id: 'open-context',
    bot_intro: 'intro',
    client_assigned_uuid: 'stable-id',
    created_at: 123,
    blocks: message.blocks,
  });
  await api.createConversation({ open, message, quickReplyId: 'bot-option' });
  expect(request).toHaveBeenLastCalledWith(
    'custom_bots/trigger_inbound_conversation',
    {
      id: 'bot-option',
      client_assigned_uuid: 'stable-id',
      messenger_open_request_id: 'open-context',
    },
  );
});

it('encodes form fields but rejects a non-conversation path before transport', async () => {
  const request = jest.fn(async () => ({}));
  const api = createMessengerApi({ request, assertCurrent: async () => {} });
  const field = {
    partId: '17',
    identifier: 'email',
    value: 'test@example.com',
  };
  await api.submitForm('42', field);
  expect(request).toHaveBeenCalledWith('conversations/42/form', {
    form_params: {
      conversation_part_id: '17',
      identifier: 'email',
      value: 'test@example.com',
    },
  });
  request.mockClear();
  await expect(api.submitForm('../admins', field)).rejects.toThrow(
    'Invalid support conversation',
  );
  expect(request).not.toHaveBeenCalled();
});
