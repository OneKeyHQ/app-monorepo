import {
  intercomHttpUrl,
  intercomMessageBlocks,
  intercomText,
  parseIntercomArticleSearch,
  parseIntercomConversation,
  parseIntercomHome,
  parseIntercomInbox,
  parseIntercomOpen,
  parseIntercomPart,
} from './messengerModels';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));

const conversation = {
  id: '42',
  read: false,
  participants: [{ id: 'agent', name: 'Support', is_admin: true }],
  conversation_parts: [
    {
      id: 'part-1',
      participant_id: 'agent',
      created_at: 1_700_000_000,
      body: [{ type: 'paragraph', text: '<p>Hello &amp; welcome</p>' }],
      reply_options: [{ uuid: 'yes', text: 'Yes' }],
    },
  ],
  composer_state: { visibility: 'visible_and_enabled' },
};

it('reads the native inbox cursor and participant/message data', () => {
  const inbox = parseIntercomInbox({
    conversation_page: {
      conversations: [conversation],
      more_pages_available: true,
    },
  });
  expect(inbox.before).toBe(1_700_000_000);
  expect(inbox.nextPage).toBeUndefined();
  expect(inbox.hasMore).toBe(true);
  expect(inbox.conversations[0].parts[0]).toMatchObject({
    author: 'Support',
    isAdmin: true,
    blocks: [{ type: 'paragraph', text: 'Hello & welcome' }],
    replies: [{ id: 'yes', text: 'Yes' }],
  });
});

it.each(['visible_and_disabled', 'hidden'])(
  'respects the server composer state %s',
  (visibility) => {
    expect(
      parseIntercomConversation({
        ...conversation,
        composer_state: { visibility },
      }).canReply,
    ).toBe(false);
  },
);

it('respects ended conversations independently of composer visibility', () => {
  expect(
    parseIntercomConversation({
      ...conversation,
      prevent_end_user_replies: true,
    }).canReply,
  ).toBe(false);
});

it('preserves bot context and server copy when starting a conversation', () => {
  expect(
    parseIntercomOpen({
      new_conversation: {
        cta: { text: 'Ask a question' },
        team_intro: 'We can help',
        parts: conversation.conversation_parts,
      },
      request_id: 'open-1',
      resolution_bot_behavior_version_id: 17,
      bot_intro_id: 'intro',
      composer_state: { visibility: 'visible_and_enabled' },
    }),
  ).toMatchObject({
    newConversationLabel: 'Ask a question',
    canCreateConversation: true,
    createParams: {
      messenger_open_request_id: 'open-1',
      resolution_bot_behavior_version_id: 17,
      bot_intro: 'intro',
    },
  });
});

it('rejects malformed responses instead of showing an empty inbox or writable composer', () => {
  expect(() => parseIntercomInbox({})).toThrow('Invalid support inbox');
  expect(() => parseIntercomOpen({})).toThrow('Invalid support configuration');
  expect(() => parseIntercomConversation({})).toThrow(
    'Invalid support conversation',
  );
});

it('escapes text before sending an SDK HTML paragraph', () => {
  expect(intercomMessageBlocks('<script>alert(1)</script> &\nhello')).toEqual([
    {
      type: 'paragraph',
      text: '&lt;script&gt;alert(1)&lt;/script&gt; &amp;<br>hello',
    },
  ]);
});

it.each(['<script', '<img src=x onerror=alert(1)', '<div class="unfinished'])(
  'removes an unfinished markup fragment from plain text: %s',
  (fragment) => {
    expect(intercomText(`<p>Hello</p>${fragment}`)).toBe('Hello');
  },
);

it('preserves escaped user text containing angle brackets and line breaks', () => {
  const text = '1 < 2 > 0\n<script> stays literal';
  expect(intercomText(intercomMessageBlocks(text)[0].text)).toBe(text);
});

it.each([
  // eslint-disable-next-line no-script-url -- Verify that executable URLs are rejected.
  'javascript:alert(1)',
  'file:///wallet',
  'https://user:password@example.com',
  'http://example.com',
])('does not render an unsafe attachment %s', (url) => {
  expect(intercomHttpUrl(url)).toBeUndefined();
});

it('preserves HTTPS attachment links', () => {
  expect(intercomHttpUrl('https://uploads.intercomcdn.com/image.png')).toBe(
    'https://uploads.intercomcdn.com/image.png',
  );
});

it('keeps inline support links actionable and decodes numeric text entities', () => {
  const part = parseIntercomPart({
    id: 'linked',
    body: [
      {
        type: 'paragraph',
        text: '<a href="https://help.onekey.so/?a=1&amp;b=2">Read &#39;this&#39;</a>',
      },
    ],
  });
  expect(part.blocks[0].links).toEqual([
    { text: "Read 'this'", url: 'https://help.onekey.so/?a=1&b=2' },
  ]);
  expect(intercomText('&#x1f44b; &#1114112;')).toBe('👋 &#1114112;');
});

it('preserves bot suggestions while respecting a disabled free text composer', () => {
  expect(
    parseIntercomOpen({
      new_conversation: {
        cta: { text: 'Contact us' },
        special_notice: 'Support notice',
      },
      composer_suggestions: {
        composerDisabled: true,
        prompt: [{ text: 'What can we help with?' }],
        suggestions: [{ uuid: 'order', text: 'Order status' }],
        snapshot_id: 7,
      },
    }),
  ).toMatchObject({
    canCreateConversation: true,
    canWriteMessage: false,
    notice: 'Support notice',
    suggestionPrompt: 'What can we help with?',
    suggestions: [{ id: 'order', text: 'Order status' }],
    createParams: {
      composer_suggestions: '[{"uuid":"order"}]',
      snapshot_id: 7,
    },
  });
});

it('normalizes web conversation messages, nested parts, bot authors and forms', () => {
  const result = parseIntercomConversation({
    id: '42',
    read: true,
    title: 'Support',
    conversation_message: {
      id: 'first',
      created_at: 1,
      blocks: [{ type: 'paragraph', text: 'Test' }],
    },
    conversation_parts: {
      conversation_parts: [
        {
          id: 'second',
          created_at: 2,
          author: { is_admin: true, first_name: 'Fin' },
          blocks: [{ type: 'paragraph', text: 'Reply' }],
          form: {
            attributes: [
              { identifier: 'email', name: 'Email', type: 'email', value: '' },
            ],
          },
          reply_options: [{ uuid: 'option', text: 'Continue' }],
        },
      ],
    },
  });
  expect(result.parts.map((part) => part.id)).toEqual([
    'message-first',
    'second',
  ]);
  expect(result.parts[1]).toMatchObject({
    isAdmin: true,
    author: 'Fin',
    replies: [{ id: 'option', text: 'Continue' }],
    form: { fields: [{ identifier: 'email', label: 'Email', type: 'email' }] },
  });
});

it('uses the web pagination cursor instead of a message timestamp', () => {
  expect(
    parseIntercomInbox({
      pages: { page: 2, total_pages: 3 },
      conversations: [],
    }),
  ).toMatchObject({ hasMore: true, nextPage: 3 });
  expect(
    parseIntercomInbox({
      pages: { page: 3, total_pages: 3 },
      conversations: [],
    }).hasMore,
  ).toBe(false);
});

it('reads configured home copy and safe avatars without rendering markup or executable URLs', () => {
  const open = parseIntercomOpen({
    messenger_configuration: {
      customization: { brand_name: 'OneKey' },
      home: {
        header: {
          background: {
            type: 'image',
            enabled: false,
            image_url: 'https://example.com/support-header.png',
            image_dark_url: 'file:///private/header',
          },
          content: {
            greeting: { content: '<b>Hello</b> &#128075;' },
            introduction: { content: 'How can we help?' },
            show_avatars: false,
            logo_url: 'https://example.com/logo.png',
          },
        },
      },
    },
    new_conversation: {
      cta: { text: 'Contact us', subtitle: 'The team can help' },
      header: {
        collapsed: {
          title: 'Support',
          subtitle: 'We are here',
          avatar_details: {
            avatars: [
              { initials: 'AB', image_url: 'https://example.com/avatar.png' },
              { initials: 'CD', image_url: 'file:///private/avatar' },
            ],
          },
        },
      },
    },
  });
  expect(open.appearance).toMatchObject({
    brandName: 'OneKey',
    greeting: 'Hello 👋',
    introduction: 'How can we help?',
    showAvatars: false,
    logoUrl: 'https://example.com/logo.png',
    headerImageUrl: 'https://example.com/support-header.png',
    headerImageDarkUrl: undefined,
  });
  expect(open.newConversationSubtitle).toBe('The team can help');
  expect(open.header.avatars[0].imageUrl).toBe(
    'https://example.com/avatar.png',
  );
  expect(open.header.avatars[1].imageUrl).toBeUndefined();
  expect(
    parseIntercomPart({
      author: {
        avatar: { image_urls: { square_128: 'https://example.com/agent.png' } },
      },
    }).avatar?.imageUrl,
  ).toBe('https://example.com/agent.png');
});

it('uses the configured home navigation, suggested articles and safe external links', () => {
  const home = parseIntercomHome({
    cards: [
      {
        type: 'spaces',
        space_items: [
          { type: 'home', label: 'Home' },
          { type: 'messages', label: 'Messages' },
        ],
      },
      { type: 'new_conversation', action: { label: 'Send us a message' } },
      {
        type: 'help_center',
        suggested_articles: [
          {
            id: '123',
            title: '<b>Contact us</b>',
            url: 'https://help.onekey.so/en/articles/123',
          },
          { id: '124', title: 'Invalid', url: 'file:///private' },
        ],
      },
      {
        type: 'external_links',
        links: [
          {
            label: 'Collaboration',
            href: 'https://help.onekey.so/en/articles/456',
          },
          { label: 'Invalid', href: 'data:text/html,content' },
        ],
      },
    ],
  });
  expect(home).toMatchObject({
    homeLabel: 'Home',
    messagesLabel: 'Messages',
    newConversationLabel: 'Send us a message',
    recentConversationLimit: 0,
  });
  expect(home.articles).toEqual([
    {
      id: '123',
      title: 'Contact us',
      url: 'https://help.onekey.so/en/articles/123',
      summary: '',
    },
  ]);
  expect(home.links).toEqual([
    { label: 'Collaboration', url: 'https://help.onekey.so/en/articles/456' },
  ]);
  expect(() => parseIntercomHome({})).toThrow('Invalid support home');
});

it('normalizes relative help search URLs and rejects malformed search responses', () => {
  expect(
    parseIntercomArticleSearch({
      articles: [
        {
          id: '123',
          title: 'Bluetooth',
          url: '/en/articles/123',
          summary: '<highlight>Bluetooth</highlight> setup',
        },
      ],
    }),
  ).toEqual([
    {
      id: '123',
      title: 'Bluetooth',
      url: 'https://help.onekey.so/en/articles/123',
      summary: 'Bluetooth setup',
    },
  ]);
  expect(() => parseIntercomArticleSearch({})).toThrow(
    'Invalid support search',
  );
});
