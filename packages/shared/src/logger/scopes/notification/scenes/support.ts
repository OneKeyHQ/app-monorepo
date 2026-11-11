import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export type ISupportConversationIdSource =
  | 'extras.params'
  | 'data'
  | 'payload'
  | undefined;

export type ISupportOpenBranch =
  | 'native-conversation'
  | 'native-messages'
  | 'native-home'
  | 'native-webview-fallback'
  | 'web-conversation'
  | 'web-messages'
  | 'web-home'
  | 'extension-webview';

// OK-66809: temporary support-reply notification diagnostics. Every argument is
// an auditable routing value (ids, branch names, booleans); payload content is
// never passed here. Remove this scene and its call sites after the QA build
// confirms where the conversation id is lost.
export class SupportScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  supportReplyReceived({
    mode,
    action,
    conversationId,
    conversationIdSource,
    msgId,
  }: {
    mode: string | number | undefined;
    action: string | undefined;
    conversationId: string | undefined;
    conversationIdSource: ISupportConversationIdSource;
    msgId: string | undefined;
  }) {
    return { mode, action, conversationId, conversationIdSource, msgId };
  }

  // Fires for every notification click before mode routing, so a payload that
  // never reaches the support command (old-version payload, missing mode/payload)
  // is still visible in the logs, together with its source.
  @LogToLocal({ level: 'info' })
  supportReplyClicked({
    mode,
    hasPayload,
    isFromNotificationClick,
  }: {
    mode: string | number | undefined;
    hasPayload: boolean;
    isFromNotificationClick: boolean;
  }) {
    return { mode, hasPayload, isFromNotificationClick };
  }

  @LogToLocal({ level: 'info' })
  supportReplyQueued({
    conversationId,
    hasSourceNodeId,
    opensExpandTab,
  }: {
    conversationId: string | undefined;
    hasSourceNodeId: boolean;
    opensExpandTab: boolean;
  }) {
    return { conversationId, hasSourceNodeId, opensExpandTab };
  }

  @LogToLocal({ level: 'info' })
  supportReplyClaimed({
    conversationId,
    hasPending,
  }: {
    conversationId: string | undefined;
    hasPending: boolean;
  }) {
    return { conversationId, hasPending };
  }

  @LogToLocal({ level: 'info' })
  supportReplyBranch({
    conversationId,
    selectedBranch,
    nativeSdkReady,
  }: {
    conversationId: string | undefined;
    selectedBranch: ISupportOpenBranch;
    nativeSdkReady?: boolean;
  }) {
    return { conversationId, selectedBranch, nativeSdkReady };
  }
}
