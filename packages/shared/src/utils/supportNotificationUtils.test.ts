import { isSupportNotification } from './supportNotificationUtils';

const payload = JSON.stringify({
  action: 'openSupportConversation',
  data: { conversationId: 'conversation-123' },
});

describe('support notification classification', () => {
  it.each([
    { mode: 6, payload },
    { mode: '6', payload },
    { extras: { mode: 6, payload } },
    { body: { mode: '6', payload } },
    { body: { extras: { mode: 6, payload } } },
    { mode: 6, payload: '{"action":"openSupportConversation"}' },
  ])('recognizes the support command in platform data %p', (data) => {
    expect(isSupportNotification(data)).toBe(true);
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { mode: 1, payload },
    { mode: 6.5, payload },
    { mode: true, payload },
    { mode: 6, payload: '{' },
    { mode: 6, payload: 'null' },
    { mode: 6, payload: '[]' },
    { mode: 6, payload: { action: 'openSupportConversation' } },
    { mode: 6, payload: '{"action":"openHardwareSalesOrder"}' },
  ])('does not suppress unrelated or malformed data %p', (data) => {
    expect(isSupportNotification(data)).toBe(false);
  });
});
