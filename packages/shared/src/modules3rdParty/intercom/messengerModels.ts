import { OneKeyLocalError } from '../../errors';

import type {
  IIntercomAppearance,
  IIntercomArticleLink,
  IIntercomAvatar,
  IIntercomBlock,
  IIntercomConversation,
  IIntercomHeader,
  IIntercomHome,
  IIntercomInbox,
  IIntercomOpen,
  IIntercomPart,
} from './messengerTypes';

export function intercomRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const string = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const number = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export function intercomText(value: unknown): string {
  // Remove raw markup, including unfinished tags, before decoding entities
  // so escaped user input remains literal text for React Native text nodes.
  // cspell:ignore apos
  return (
    string(value)
      // Comparisons are literal text, not the start of an HTML tag.
      .replace(/<(?!\/?[a-z!])/gi, '&lt;')
      .replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, '\n')
      .replace(/<[^>]*(?:>|$)/g, '')
      .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, code: string) => {
        const point = code.toLowerCase().startsWith('x')
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10);
        return point > 0 &&
          point <= 0x10_ff_ff &&
          !(point >= 0xd8_00 && point <= 0xdf_ff)
          ? String.fromCodePoint(point)
          : entity;
      })
      .replace(
        /&(amp|lt|gt|quot|apos|nbsp);/g,
        (_, entity: string) =>
          ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' })[
            entity
          ] ?? '',
      )
      .trim()
  );
}

export function intercomHttpUrl(value: unknown): string | undefined {
  try {
    const url = new URL(string(value));
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function parseAvatar(value: unknown): IIntercomAvatar {
  const avatar = intercomRecord(value);
  return {
    imageUrl: intercomHttpUrl(
      avatar.image_url ?? intercomRecord(avatar.image_urls).square_128,
    ),
    imageDarkUrl: intercomHttpUrl(
      avatar.image_dark_url ??
        intercomRecord(avatar.image_dark_urls).square_128,
    ),
    initials: intercomText(avatar.initials).slice(0, 2),
    label: intercomText(avatar.label),
  };
}

function parseHeader(value: unknown): IIntercomHeader {
  const header = intercomRecord(value);
  const collapsed = intercomRecord(header.collapsed ?? header.expanded);
  return {
    title: intercomText(collapsed.title),
    subtitle: intercomText(collapsed.subtitle),
    avatars: list(intercomRecord(collapsed.avatar_details).avatars).map(
      parseAvatar,
    ),
  };
}

function parseAppearance(value: unknown): IIntercomAppearance {
  const modules = intercomRecord(value);
  const customization = intercomRecord(modules.customization);
  const header = intercomRecord(intercomRecord(modules.home).header);
  const content = intercomRecord(header.content);
  const background = intercomRecord(header.background);
  return {
    brandName: intercomText(customization.brand_name),
    logoUrl: intercomHttpUrl(
      content.logo_url ?? customization.messenger_logo_url,
    ),
    logoDarkUrl: intercomHttpUrl(
      content.logo_dark_url ?? customization.messenger_logo_dark_url,
    ),
    headerImageUrl: intercomHttpUrl(background.image_url),
    headerImageDarkUrl: intercomHttpUrl(background.image_dark_url),
    greeting: intercomText(intercomRecord(content.greeting).content),
    introduction: intercomText(intercomRecord(content.introduction).content),
    showAvatars: content.show_avatars !== false,
  };
}

function parseArticleLinks(value: unknown): IIntercomArticleLink[] {
  return list(value).flatMap((item) => {
    const article = intercomRecord(item);
    const id = string(article.id);
    const title = intercomText(article.title);
    const href = string(article.url);
    const url = intercomHttpUrl(
      href.startsWith('/') && !href.startsWith('//')
        ? `https://help.onekey.so${href}`
        : href,
    );
    const summary = intercomText(article.summary);
    return /^\d+$/.test(id) && title && url
      ? [{ id, title, url, summary }]
      : [];
  });
}

export function parseIntercomHome(value: unknown): IIntercomHome {
  const data = intercomRecord(value);
  if (!Array.isArray(data.cards))
    throw new OneKeyLocalError('Invalid support home');
  const cards = data.cards.map(intercomRecord);
  const spaces = list(
    cards.find((card) => card.type === 'spaces')?.space_items,
  ).map(intercomRecord);
  return {
    homeLabel: intercomText(
      spaces.find((space) => space.type === 'home')?.label,
    ),
    messagesLabel: intercomText(
      spaces.find((space) => space.type === 'messages')?.label,
    ),
    newConversationLabel: intercomText(
      intercomRecord(
        cards.find((card) => card.type === 'new_conversation')?.action,
      ).label,
    ),
    recentConversationLimit: Math.min(
      3,
      Math.max(
        0,
        number(
          cards.find((card) => card.type === 'recent_conversation')?.limit,
        ),
      ),
    ),
    articles: cards
      .filter((card) => card.type === 'help_center')
      .flatMap((card) => parseArticleLinks(card.suggested_articles)),
    links: cards
      .filter((card) => card.type === 'external_links')
      .flatMap((card) =>
        list(card.links).flatMap((item) => {
          const link = intercomRecord(item);
          const label = intercomText(link.label);
          const url = intercomHttpUrl(link.href);
          return label && url ? [{ label, url }] : [];
        }),
      ),
  };
}

export function parseIntercomArticleSearch(
  value: unknown,
): IIntercomArticleLink[] {
  const data = intercomRecord(value);
  if (!Array.isArray(data.articles))
    throw new OneKeyLocalError('Invalid support search');
  return parseArticleLinks(data.articles);
}

function parseBlock(value: unknown): IIntercomBlock {
  const block = intercomRecord(value);
  return {
    type: string(block.type),
    text: intercomText(block.text),
    title: intercomText(block.title ?? block.name),
    width: number(block.width),
    height: number(block.height),
    url: intercomHttpUrl(block.url ?? block.linkUrl ?? block.link_url),
    items: list(block.items).map(intercomText),
    links: Array.from(
      string(block.text).matchAll(
        /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi,
      ),
    ).flatMap((match) => {
      const url = intercomHttpUrl(intercomText(match[2]));
      return url ? [{ url, text: intercomText(match[3]) }] : [];
    }),
    attachments: list(block.attachments).flatMap((item) => {
      const attachment = intercomRecord(item);
      const url = intercomHttpUrl(attachment.url);
      return url ? [{ name: string(attachment.name), url }] : [];
    }),
  };
}

function parseIntercomForm(value: unknown): IIntercomPart['form'] {
  const form = intercomRecord(value);
  const fields = list(form.attributes ?? form.fields).flatMap((item) => {
    const field = intercomRecord(item);
    const identifier = string(field.identifier ?? field.name);
    const type = string(field.type ?? field.input_type);
    return identifier &&
      ['email', 'string', 'text', 'phone', 'number'].includes(type)
      ? [
          {
            identifier,
            label: intercomText(field.name ?? field.label),
            type,
            value: string(field.value),
            disabled: field.disabled === true,
          },
        ]
      : [];
  });
  return fields.length
    ? { fields, title: intercomText(form.title) }
    : undefined;
}

export function parseIntercomPart(
  value: unknown,
  participants: unknown[] = [],
): IIntercomPart {
  const part = intercomRecord(value);
  const participant = intercomRecord(
    part.author ??
      part.participant ??
      participants.find(
        (item) => intercomRecord(item).id === part.participant_id,
      ),
  );
  const blocks = list(part.body ?? part.blocks).map(parseBlock);
  const attachments = list(part.attachments);
  if (attachments.length)
    blocks.push(parseBlock({ type: 'attachmentList', attachments }));
  return {
    id: string(part.id),
    clientId: string(part.client_assigned_uuid) || undefined,
    createdAt: number(part.created_at),
    isAdmin:
      part.participant_is_admin === true ||
      participant.is_admin === true ||
      participant.type === 'admin',
    author: string(participant.name ?? participant.first_name),
    avatar: participant.avatar ? parseAvatar(participant.avatar) : undefined,
    blocks,
    replies: list(part.reply_options).flatMap((item) => {
      const reply = intercomRecord(item);
      const id = string(reply.uuid);
      return id ? [{ id, text: intercomText(reply.text) }] : [];
    }),
    form: parseIntercomForm(part.form),
    hasUnsupportedContent: blocks.some(
      (block) =>
        ![
          'paragraph',
          'heading',
          'subheading',
          'code',
          'image',
          'localImage',
          'attachmentList',
          'unorderedList',
          'orderedList',
          'link',
          'button',
        ].includes(block.type),
    ),
  };
}

export function parseIntercomConversation(
  value: unknown,
): IIntercomConversation {
  const data = intercomRecord(value);
  const id = string(data.id);
  if (!id) throw new OneKeyLocalError('Invalid support conversation');
  const message = intercomRecord(data.conversation_message);
  const rawParts = data.conversation_parts ?? data.parts;
  const parts = [
    ...(message.id && message.hidden !== true
      ? [{ ...message, id: `message-${String(message.id)}` }]
      : []),
    ...list(intercomRecord(rawParts).conversation_parts ?? rawParts),
  ]
    .filter(
      (part) =>
        intercomRecord(part).part_type !== 'lightweight_reply_user_response',
    )
    .map((part) => parseIntercomPart(part, list(data.participants)));
  const composer = intercomRecord(data.composer_state);
  return {
    id,
    title:
      intercomText(data.title) ||
      parts.find((part) => part.isAdmin)?.author ||
      '',
    read: data.read === true,
    updatedAt: number(data.updated_at) || parts.at(-1)?.createdAt || 0,
    parts,
    canReply:
      data.prevent_end_user_replies !== true &&
      (!composer.visibility || composer.visibility === 'visible_and_enabled'),
    placeholder: intercomText(composer.placeholder) || undefined,
    header: parseHeader(data.header),
  };
}

export function parseIntercomInbox(value: unknown): IIntercomInbox {
  const data = intercomRecord(value);
  const legacy = intercomRecord(data.conversation_page);
  const values = data.conversations ?? legacy.conversations;
  if (!Array.isArray(values))
    throw new OneKeyLocalError('Invalid support inbox');
  const pages = intercomRecord(data.pages);
  const page = number(pages.page);
  const conversations = values.map(parseIntercomConversation);
  return {
    conversations,
    hasMore:
      page < number(pages.total_pages) || legacy.more_pages_available === true,
    before: conversations.at(-1)?.updatedAt,
    nextPage: page > 0 ? page + 1 : undefined,
  };
}

export function parseIntercomOpen(value: unknown): IIntercomOpen {
  const data = intercomRecord(value);
  const newConversation = intercomRecord(data.new_conversation);
  const cta = intercomRecord(newConversation.cta);
  if (typeof cta.text !== 'string')
    throw new OneKeyLocalError('Invalid support configuration');
  const composer = intercomRecord(data.composer_state);
  const createParams: Record<string, string | number> = {};
  const composerSuggestions = intercomRecord(data.composer_suggestions);
  const suggestions = list(composerSuggestions.suggestions).flatMap((item) => {
    const option = intercomRecord(item);
    return typeof option.uuid === 'string'
      ? [{ id: option.uuid, text: intercomText(option.text) }]
      : [];
  });
  if (suggestions.length)
    createParams.composer_suggestions = JSON.stringify(
      suggestions.map((item) => ({ uuid: item.id })),
    );
  if (typeof composerSuggestions.snapshot_id === 'number')
    createParams.snapshot_id = composerSuggestions.snapshot_id;
  if (typeof data.request_id === 'string')
    createParams.messenger_open_request_id = data.request_id;
  if (typeof data.resolution_bot_behavior_version_id === 'number')
    createParams.resolution_bot_behavior_version_id =
      data.resolution_bot_behavior_version_id;
  if (typeof data.bot_intro_id === 'string')
    createParams.bot_intro = data.bot_intro_id;
  return {
    canCreateConversation: data.inbound_conversations_disabled !== true,
    canWriteMessage:
      data.inbound_conversations_disabled !== true &&
      composerSuggestions.composer_disabled !== true &&
      composerSuggestions.composerDisabled !== true &&
      (!composer.visibility || composer.visibility === 'visible_and_enabled'),
    welcome: intercomText(newConversation.team_intro) || undefined,
    composerPlaceholder: intercomText(composer.placeholder) || undefined,
    suggestionPrompt:
      list(composerSuggestions.prompt)
        .map((item) => intercomText(intercomRecord(item).text))
        .filter(Boolean)
        .join('\n') || undefined,
    notice: intercomText(newConversation.special_notice) || undefined,
    newConversationLabel: intercomText(cta.text),
    newConversationSubtitle: intercomText(cta.subtitle),
    header: parseHeader(newConversation.header),
    appearance: parseAppearance(data.messenger_configuration),
    initialParts: list(newConversation.parts).map((part) =>
      parseIntercomPart(part, list(newConversation.participants)),
    ),
    createParams,
    suggestions,
  };
}

export function intercomMessageBlocks(text: string): IIntercomBlock[] {
  // The Messenger accepts HTML in paragraph blocks; user text must remain literal.
  return [
    {
      type: 'paragraph',
      text: text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>'),
    },
  ];
}
