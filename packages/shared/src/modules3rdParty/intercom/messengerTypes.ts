export type IIntercomSupportRoute = {
  userId: string | null;
  requestId?: string;
  conversationId?: string;
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

export type IIntercomMessengerSession = {
  request: (
    path: string,
    parameters?: Record<string, unknown>,
  ) => Promise<unknown>;
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
