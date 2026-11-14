export type IIntercomNotification = {
  id: string;
  conversationId: string;
  author: string;
  message: string;
  avatarUrl?: string;
};

export type IIntercomBlock = {
  type: string;
  text?: string;
  url?: string;
  title?: string;
  width?: number;
  height?: number;
  items?: string[];
  links?: { text: string; url: string }[];
  attachments?: { name: string; url: string }[];
};

export type IIntercomAvatar = {
  imageUrl?: string;
  imageDarkUrl?: string;
  initials: string;
  label: string;
};

export type IIntercomHeader = {
  title: string;
  subtitle: string;
  avatars: IIntercomAvatar[];
};

export type IIntercomAppearance = {
  brandName: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  headerImageUrl?: string;
  headerImageDarkUrl?: string;
  greeting: string;
  introduction: string;
  showAvatars: boolean;
};

export type IIntercomArticleLink = {
  id: string;
  title: string;
  url: string;
  summary?: string;
};

export type IIntercomHome = {
  homeLabel: string;
  messagesLabel: string;
  newConversationLabel: string;
  recentConversationLimit: number;
  articles: IIntercomArticleLink[];
  links: { label: string; url: string }[];
};

export type IIntercomPart = {
  id: string;
  clientId?: string;
  createdAt: number;
  isAdmin: boolean;
  author: string;
  avatar?: IIntercomAvatar;
  blocks: IIntercomBlock[];
  replies: { id: string; text: string }[];
  hasUnsupportedContent: boolean;
  form?: {
    title: string;
    fields: {
      identifier: string;
      label: string;
      type: string;
      value: string;
      disabled: boolean;
    }[];
  };
};

export type IIntercomConversation = {
  id: string;
  title: string;
  read: boolean;
  updatedAt: number;
  parts: IIntercomPart[];
  canReply: boolean;
  placeholder?: string;
  header: IIntercomHeader;
};

export type IIntercomInbox = {
  conversations: IIntercomConversation[];
  hasMore: boolean;
  before?: number;
  nextPage?: number;
};

export type IIntercomOpen = {
  canCreateConversation: boolean;
  canWriteMessage: boolean;
  welcome?: string;
  composerPlaceholder?: string;
  suggestionPrompt?: string;
  notice?: string;
  newConversationLabel: string;
  newConversationSubtitle: string;
  header: IIntercomHeader;
  appearance: IIntercomAppearance;
  initialParts: IIntercomPart[];
  suggestions: { id: string; text: string }[];
  createParams: Record<string, string | number>;
};

export type IIntercomOutgoingMessage = {
  clientId: string;
  createdAt?: number;
  blocks: IIntercomBlock[];
};

export type IIntercomMessengerSession = {
  listConversations: (
    cursor?: Pick<IIntercomInbox, 'nextPage' | 'before'>,
  ) => Promise<IIntercomInbox>;
  getConversation: (id: string) => Promise<IIntercomConversation>;
  getHome: () => Promise<IIntercomHome>;
  getOpen: () => Promise<IIntercomOpen>;
  reply: (
    id: string,
    message: IIntercomOutgoingMessage,
  ) => Promise<IIntercomPart>;
  quickReply: (
    id: string,
    reply: { clientId: string; partId: string; replyId: string; text: string },
  ) => Promise<IIntercomPart>;
  createConversation: (params: {
    message: IIntercomOutgoingMessage;
    open: IIntercomOpen;
    quickReplyId?: string;
  }) => Promise<IIntercomConversation>;
  submitForm: (
    id: string,
    field: { partId: string; identifier: string; value: string },
  ) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  refreshUnread: () => Promise<void>;
  searchArticles: (phrase: string) => Promise<IIntercomArticleLink[]>;
  getUploadMetadata: (
    image: Pick<
      IIntercomImage,
      'filename' | 'mime' | 'size' | 'width' | 'height'
    >,
  ) => Promise<{
    destination: string;
    publicUrl: string;
    fields: Record<string, string>;
  }>;
  assertCurrent: () => Promise<void>;
};

export type IIntercomImage = {
  path: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  filename?: string;
  blob?: Blob;
};
