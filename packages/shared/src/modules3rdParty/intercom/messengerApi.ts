import { OneKeyLocalError } from '../../errors';

import {
  intercomHttpUrl,
  intercomRecord,
  parseIntercomArticleSearch,
  parseIntercomConversation,
  parseIntercomHome,
  parseIntercomInbox,
  parseIntercomOpen,
  parseIntercomPart,
} from './messengerModels';

import type {
  IIntercomMessengerSession,
  IIntercomOutgoingMessage,
} from './messengerTypes';

type ITransport = {
  request: (
    path: string,
    parameters?: Record<string, unknown>,
  ) => Promise<unknown>;
  assertCurrent: () => Promise<void>;
  onRead?: (id: string) => void;
};

const messagePayload = (message: IIntercomOutgoingMessage) => ({
  client_assigned_uuid: message.clientId,
  created_at: message.createdAt,
  blocks: message.blocks,
});

const conversationPath = (id: string) => {
  if (!/^\d+$/.test(id))
    throw new OneKeyLocalError('Invalid support conversation');
  return `conversations/${id}`;
};

function replyPart(response: unknown) {
  const part = parseIntercomPart(response);
  if (!part.id) throw new OneKeyLocalError('Invalid support reply');
  return part;
}

// The only public operations are the end-user capabilities rendered by our UI.
// Wire paths, payloads and response normalization stay within shared.
export function createMessengerApi({
  request,
  assertCurrent,
  onRead,
}: ITransport): IIntercomMessengerSession {
  return {
    assertCurrent,
    async listConversations(cursor) {
      const parameters: Record<string, number> = { per_page: 20 };
      if (cursor?.nextPage !== undefined) parameters.page = cursor.nextPage;
      else if (cursor?.before !== undefined) parameters.before = cursor.before;
      return parseIntercomInbox(await request('conversations', parameters));
    },
    async getConversation(id) {
      return parseIntercomConversation(
        await request(conversationPath(id), {
          request_origin: 'State Sync',
        }),
      );
    },
    async getHome() {
      return parseIntercomHome(await request('home'));
    },
    async getOpen() {
      return parseIntercomOpen(await request('new_conversation_content'));
    },
    async reply(id, message) {
      return replyPart(
        await request(`${conversationPath(id)}/reply`, messagePayload(message)),
      );
    },
    async quickReply(id, reply) {
      return replyPart(
        await request(`${conversationPath(id)}/quick_reply`, {
          client_assigned_uuid: reply.clientId,
          conversation_part: {
            // Initial messages have a local prefix; the protocol identifies them
            // with null rather than a conversation-part id.
            id: reply.partId.startsWith('message-') ? null : reply.partId,
            reply_option: {
              uuid: reply.replyId,
              text: reply.text,
              type: 'quick_reply',
            },
          },
        }),
      );
    },
    async createConversation({ message, open, quickReplyId }) {
      if (!open.canCreateConversation)
        throw new OneKeyLocalError('Support composer is unavailable');
      return parseIntercomConversation(
        quickReplyId
          ? await request('custom_bots/trigger_inbound_conversation', {
              id: quickReplyId,
              client_assigned_uuid: message.clientId,
              messenger_open_request_id:
                open.createParams.messenger_open_request_id,
            })
          : await request('messages', {
              ...open.createParams,
              ...messagePayload(message),
            }),
      );
    },
    async submitForm(id, field) {
      await request(`${conversationPath(id)}/form`, {
        form_params: {
          conversation_part_id: field.partId,
          identifier: field.identifier,
          value: field.value,
        },
      });
    },
    async markRead(id) {
      await request(`${conversationPath(id)}/read`);
      onRead?.(id);
    },
    async refreshUnread() {
      await request('conversations/unread');
    },
    async searchArticles(phrase) {
      return parseIntercomArticleSearch(
        await request('articles/search', { phrase }),
      );
    },
    async getUploadMetadata(image) {
      const response = intercomRecord(
        await request('uploads', {
          upload: {
            original_filename: image.filename,
            content_type: image.mime,
            size_in_bytes: image.size,
            width: image.width,
            height: image.height,
          },
          include_metadata: true,
        }),
      );
      const destination = intercomHttpUrl(response.upload_destination);
      const publicUrl = intercomHttpUrl(response.public_url);
      if (!destination || !publicUrl || typeof response.policy !== 'string')
        throw new OneKeyLocalError('Invalid support upload destination');
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries({
        key: response.key,
        acl: response.acl,
        'Content-Type': response.content_type,
        AWSAccessKeyId: response.aws_access_key,
        policy: response.policy,
        signature: response.signature,
        success_action_status: response.success_action_status,
        'x-amz-meta-safe_app_id': intercomRecord(response.metadata).safe_app_id,
      })) {
        if (typeof value === 'string' || typeof value === 'number')
          fields[key] = String(value);
      }
      return { destination, publicUrl, fields };
    },
  };
}
