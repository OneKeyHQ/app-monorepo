/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IIntercomImage,
  IIntercomMessengerSession,
  IIntercomSupportRoute,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { uploadIntercomImage } from '@onekeyhq/shared/src/modules3rdParty/intercom/upload';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { cleanSupportImage, pickSupportImage } from '../utils/pickSupportImage';

import SupportScreen from './SupportScreen';

let mockLocked = false;
let mockFailSend = false;
let mockFailRefresh = false;
let mockFocused = true;
const mockSetParams = jest.fn();
const mockNavigation = {
  setParams: mockSetParams,
  popStack: jest.fn(),
  pop: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
const mockRequest = jest.fn<
  ReturnType<IIntercomMessengerSession['request']>,
  Parameters<IIntercomMessengerSession['request']>
>();
const mockSession: IIntercomMessengerSession = {
  request: mockRequest,
  assertCurrent: async () => {},
};
const mockRoute: {
  name: string;
  key: string;
  params: IIntercomSupportRoute;
} = {
  name: 'IntercomConversation',
  key: 'chat',
  params: { userId: null },
};
const mockCreateSession = jest.fn(async () => mockSession);

jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom', () => ({
  createIntercomMessengerSession: () => mockCreateSession(),
  showIntercom: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/intercom/upload', () => ({
  uploadIntercomImage: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/utils/dateUtils', () => ({
  __esModule: true,
  default: { formatDate: () => '12:00', formatTime: () => '12:00' },
  formatRelativeDate: () => 'Today',
  formatRelativeTimeAbbr: () => '1m',
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_support: 'Support',
    global_send: 'Send',
    global_contact_us: 'Support',
    global_retry: 'Retry',
    global_cancel: 'Cancel',
    global_home: 'Home',
    global_close: 'Close',
    global_search: 'Search',
  },
}));
jest.mock('../utils/pickSupportImage', () => ({
  pickSupportImage: jest.fn(),
  cleanSupportImage: jest.fn(async () => {}),
}));
jest.mock('@react-navigation/native', () => ({ useRoute: () => mockRoute }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));
jest.mock('@onekeyhq/kit/src/hooks/useHelpLink', () => ({
  useHelpLink: () => 'https://help.onekey.so',
}));
jest.mock('@onekeyhq/kit/src/hooks/useIntercomUnreadCount', () => ({
  useIntercomUnreadCount: () => 0,
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [{ isLoggedIn: false }],
}));
jest.mock('../../WebView/utils/webViewNavigation', () => ({
  openWebView: jest.fn(),
}));
jest.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: jest.fn() }),
  },
  FlatList: <T,>({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
  }: {
    data: T[];
    renderItem: (item: { item: T; index: number }) => ReactNode;
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {data.map((item, index) => (
        <div key={index}>{renderItem({ item, index })}</div>
      ))}
      {ListFooterComponent}
    </div>
  ),
}));
jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
    onPress,
  }: PropsWithChildren<{ testID?: string; onPress?: () => void }>) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  const Button = ({
    children,
    onPress,
    disabled,
    testID,
  }: PropsWithChildren<{
    onPress?: () => void;
    disabled?: boolean;
    testID?: string;
  }>) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
  return {
    useSafeAreaInsets: () => ({ bottom: 0 }),
    useTheme: () => ({
      bgApp: { val: '#ffffff' },
      bgSubdued: { val: '#eeeeee' },
    }),
    Page: Object.assign(View, { Header: () => null, Body: View, Footer: View }),
    Button,
    IconButton: Button,
    YStack: View,
    XStack: View,
    LinearGradient: View,
    SizableText: View,
    Spinner: () => <div>Loading</div>,
    Icon: () => null,
    Image: () => null,
    Empty: ({
      buttonProps,
    }: {
      buttonProps?: {
        children?: ReactNode;
        onPress?: () => void;
        testID?: string;
      };
    }) => <Button {...buttonProps} testID={buttonProps?.testID} />,
    TextArea: ({
      value,
      onChangeText,
      editable,
      testID,
    }: {
      value: string;
      onChangeText: (text: string) => void;
      editable: boolean;
      testID: string;
    }) => (
      <textarea
        data-testid={testID}
        value={value}
        disabled={!editable}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
  };
});

const part = {
  id: 'part-1',
  created_at: 1_700_000_000,
  body: [{ type: 'paragraph', text: 'Hello support' }],
};
const conversation = {
  id: '42',
  read: true,
  conversation_parts: [part],
  composer_state: { visibility: 'visible_and_enabled' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLocked = false;
  mockFailSend = false;
  mockFailRefresh = false;
  mockFocused = true;
  mockRoute.name = 'IntercomConversation';
  mockRoute.params = { userId: null };
  mockRequest.mockReset().mockImplementation(async (path) => {
    if (path === 'home')
      return {
        cards: [
          {
            type: 'spaces',
            space_items: [
              { type: 'home', label: 'Home' },
              { type: 'messages', label: 'Messages' },
            ],
          },
          { type: 'recent_conversation', limit: 2 },
          {
            type: 'help_center',
            suggested_articles: [
              {
                id: '123',
                title: 'Contact Us',
                url: 'https://help.onekey.so/en/articles/123',
              },
            ],
          },
          {
            type: 'external_links',
            links: [
              {
                label: 'Looking for collaboration?',
                href: 'https://help.onekey.so/en/articles/456',
              },
            ],
          },
        ],
      };
    if (path === 'new_conversation_content')
      return {
        new_conversation: { cta: { text: 'Start a conversation' } },
        request_id: 'open-1',
      };
    if (path === 'messages') {
      if (mockFailSend) throw new OneKeyLocalError('offline');
      return conversation;
    }
    if (path === 'conversations/42') {
      if (mockFailRefresh) throw new OneKeyLocalError('offline');
      return conversation;
    }
    if (path === 'conversations/42/reply') return { ...part, id: 'part-2' };
    if (path === 'conversations')
      return {
        conversation_page: {
          conversations: [conversation],
          more_pages_available: true,
        },
      };
    throw new OneKeyLocalError(`Unexpected request: ${path}`);
  });
});

it('opens the RN home, message list and an existing conversation', async () => {
  mockRoute.name = 'IntercomHome';
  render(<SupportScreen />);
  await screen.findByTestId('support-conversation-42');
  expect(screen.getByTestId('support-message-history').textContent).toBe(
    'Messages',
  );
  expect(screen.queryByTestId('support-help-center')).toBeNull();
  fireEvent.click(screen.getByTestId('support-help-search'));
  expect(mockNavigation.push).toHaveBeenCalledWith('IntercomHelp', {
    userId: null,
  });
  fireEvent.click(screen.getByTestId('support-article-123'));
  expect(openUrlExternal).toHaveBeenCalledWith(
    'https://help.onekey.so/en/articles/123',
  );
  fireEvent.click(screen.getByTestId('support-home-external-link'));
  expect(openUrlExternal).toHaveBeenCalledWith(
    'https://help.onekey.so/en/articles/456',
  );
  fireEvent.click(screen.getByTestId('support-message-history'));
  expect(mockNavigation.push).toHaveBeenCalledWith('IntercomMessages', {
    userId: null,
  });
  fireEvent.click(screen.getByTestId('support-conversation-42'));
  expect(mockNavigation.push).toHaveBeenCalledWith('IntercomConversation', {
    userId: null,
    conversationId: '42',
  });
  fireEvent.click(screen.getByTestId('support-new-conversation'));
  expect(mockNavigation.push).toHaveBeenCalledWith('IntercomConversation', {
    userId: null,
    conversationId: undefined,
  });
});

it.each(['cursor', 'page'])(
  'loads three inbox pages using %s pagination',
  async (pagination) => {
    mockRoute.name = 'IntercomMessages';
    const original = mockRequest.getMockImplementation();
    mockRequest.mockImplementation(async (path, parameters) => {
      if (path !== 'conversations') return original?.(path, parameters);
      let page = 1;
      if (parameters?.page === 3 || parameters?.before === 200) page = 3;
      else if (parameters?.page === 2 || parameters?.before === 300) page = 2;
      const conversations = [
        {
          ...conversation,
          id: String(page * 42),
          updated_at: 400 - page * 100,
        },
      ];
      return pagination === 'page'
        ? { conversations, pages: { page, total_pages: 3 } }
        : {
            conversation_page: {
              conversations,
              more_pages_available: page < 3,
            },
          };
    });
    render(<SupportScreen />);
    await screen.findByTestId('support-conversation-42');
    fireEvent.click(screen.getByTestId('support-load-more'));
    await screen.findByTestId('support-conversation-84');
    fireEvent.click(screen.getByTestId('support-load-more'));
    await screen.findByTestId('support-conversation-126');
    expect(
      mockRequest.mock.calls.filter(([path]) => path === 'conversations'),
    ).toEqual([
      ['conversations', { per_page: 20 }],
      [
        'conversations',
        {
          per_page: 20,
          ...(pagination === 'page' ? { page: 2 } : { before: 300 }),
        },
      ],
      [
        'conversations',
        {
          per_page: 20,
          ...(pagination === 'page' ? { page: 3 } : { before: 200 }),
        },
      ],
    ]);
    expect(screen.getByTestId('support-conversation-42')).toBeTruthy();
    expect(screen.getByTestId('support-conversation-84')).toBeTruthy();
    expect(screen.queryByTestId('support-load-more')).toBeNull();
  },
);

it('discards an older inbox page when the user refreshes during pagination', async () => {
  mockRoute.name = 'IntercomMessages';
  render(<SupportScreen />);
  await screen.findByTestId('support-load-more');
  let resolvePage!: (value: unknown) => void;
  mockRequest.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
  );
  fireEvent.click(screen.getByTestId('support-load-more'));
  fireEvent.click(screen.getByTestId('support-refresh'));
  await act(async () => {
    resolvePage({
      conversation_page: {
        conversations: [{ ...conversation, id: 'stale' }],
        more_pages_available: false,
      },
    });
  });
  expect(screen.queryByTestId('support-conversation-stale')).toBeNull();
  expect(screen.getByTestId('support-conversation-42')).toBeTruthy();
});

async function enterMessage(text: string) {
  await waitFor(() =>
    expect(
      (screen.getByTestId('support-message-input') as HTMLTextAreaElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByTestId('support-message-input'), {
    target: { value: text },
  });
  fireEvent.click(screen.getByTestId('support-send'));
}

it('creates a conversation and sends to it after the route params update', async () => {
  const view = render(<SupportScreen />);
  await enterMessage('Hello support');
  await waitFor(() =>
    expect(mockSetParams).toHaveBeenCalledWith({ conversationId: '42' }),
  );
  expect(mockRequest).toHaveBeenCalledWith(
    'messages',
    expect.objectContaining({
      messenger_open_request_id: 'open-1',
      blocks: [{ type: 'paragraph', text: 'Hello support' }],
      client_assigned_uuid: expect.any(String),
    }),
  );
  mockRoute.params = { userId: null, conversationId: '42' };
  view.rerender(<SupportScreen />);
  await enterMessage('Another message');
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      'conversations/42/reply',
      expect.objectContaining({
        blocks: [{ type: 'paragraph', text: 'Another message' }],
      }),
    ),
  );
});

it('cleans a delayed image selection when the route changes', async () => {
  const selection = deferred<IIntercomImage>();
  jest.mocked(pickSupportImage).mockReturnValueOnce(selection.promise);
  mockRoute.params = { userId: null, conversationId: '42' };
  const view = render(<SupportScreen />);
  await screen.findByText('Hello support');
  fireEvent.click(screen.getByTestId('support-add-image'));
  mockRoute.params = { userId: null };
  view.rerender(<SupportScreen />);
  await act(async () =>
    selection.resolve({
      path: 'file:///test-image.jpg',
      filename: 'test-image.jpg',
      mime: 'image/jpeg',
      size: 100,
      width: 10,
      height: 10,
    }),
  );
  expect(cleanSupportImage).toHaveBeenCalledWith('file:///test-image.jpg');
  expect(screen.queryByTestId('support-remove-image')).toBeNull();
});

it('aborts an old route upload and never posts its late result into either conversation', async () => {
  const upload = deferred<Awaited<ReturnType<typeof uploadIntercomImage>>>();
  jest.mocked(uploadIntercomImage).mockReturnValueOnce(upload.promise);
  jest.mocked(pickSupportImage).mockResolvedValueOnce({
    path: 'file:///test-upload.jpg',
    filename: 'test-upload.jpg',
    mime: 'image/jpeg',
    size: 100,
    width: 10,
    height: 10,
  });
  mockRoute.params = { userId: null, conversationId: '42' };
  const view = render(<SupportScreen />);
  await screen.findByText('Hello support');
  fireEvent.click(screen.getByTestId('support-add-image'));
  await screen.findByTestId('support-remove-image');
  fireEvent.click(screen.getByTestId('support-send'));
  await waitFor(() => expect(uploadIntercomImage).toHaveBeenCalled());
  const signal = jest.mocked(uploadIntercomImage).mock.calls[0][2];
  mockRoute.params = { userId: null };
  view.rerender(<SupportScreen />);
  expect(signal?.aborted).toBe(true);
  expect(cleanSupportImage).toHaveBeenCalledWith('file:///test-upload.jpg');
  await act(async () =>
    upload.resolve({
      type: 'image',
      url: 'https://downloads.intercomcdn.com/test-image.jpg',
      width: 10,
      height: 10,
    }),
  );
  expect(mockRequest).not.toHaveBeenCalledWith(
    'conversations/42/reply',
    expect.anything(),
  );
  expect(mockRequest).not.toHaveBeenCalledWith('messages', expect.anything());
  expect(screen.queryByTestId('support-pending-message')).toBeNull();
});

it('retries with the same UUID after a failed send', async () => {
  mockFailSend = true;
  render(<SupportScreen />);
  await enterMessage('Hello support');
  await screen.findByTestId('support-retry-send');
  const first = mockRequest.mock.calls.find(
    ([path]) => path === 'messages',
  )?.[1];
  mockFailSend = false;
  fireEvent.click(screen.getByTestId('support-retry-send'));
  await waitFor(() =>
    expect(mockSetParams).toHaveBeenCalledWith({ conversationId: '42' }),
  );
  const attempts = mockRequest.mock.calls.filter(
    ([path]) => path === 'messages',
  );
  expect(attempts).toHaveLength(2);
  expect(attempts[1][1]).toEqual(first);
});

it('does not offer to resend an acknowledged message when its refresh fails', async () => {
  mockFailRefresh = true;
  render(<SupportScreen />);
  await enterMessage('Hello support');
  await waitFor(() => expect(mockSetParams).toHaveBeenCalled());
  await screen.findByTestId('support-retry');
  expect(screen.queryByTestId('support-retry-send')).toBeNull();
  expect(screen.getByText('Hello support')).toBeTruthy();
});

it('removes the draft and conversation when the app locks', async () => {
  const view = render(<SupportScreen />);
  await screen.findByTestId('support-message-input');
  fireEvent.change(screen.getByTestId('support-message-input'), {
    target: { value: 'private draft' },
  });
  await act(async () => {
    mockLocked = true;
    view.rerender(<SupportScreen />);
  });
  expect(screen.queryByTestId('support-message-input')).toBeNull();
  await act(async () => {
    mockLocked = false;
    view.rerender(<SupportScreen />);
  });
  const composer = await screen.findByTestId('support-message-input');
  expect((composer as HTMLTextAreaElement).value).toBe('');
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('isolates reused route params from old drafts and delayed replies', async () => {
  const reply = deferred<unknown>();
  mockRoute.params = { userId: null, conversationId: '42' };
  const original = mockRequest.getMockImplementation();
  mockRequest.mockImplementation(async (path, parameters) => {
    if (path === 'conversations/42/reply') return reply.promise;
    if (path === 'conversations/84')
      return {
        ...conversation,
        id: '84',
        conversation_parts: [
          {
            ...part,
            id: 'thread-b',
            body: [{ type: 'paragraph', text: 'Thread B' }],
          },
        ],
      };
    if (path === 'conversations/84/reply')
      return {
        ...part,
        id: 'reply-b',
        body: [{ type: 'paragraph', text: 'Reply B' }],
      };
    return original?.(path, parameters);
  });
  const view = render(<SupportScreen />);
  await enterMessage('Reply A');
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      'conversations/42/reply',
      expect.any(Object),
    ),
  );
  fireEvent.change(screen.getByTestId('support-message-input'), {
    target: { value: 'old private draft' },
  });
  mockRoute.params = { userId: null, conversationId: '84' };
  view.rerender(<SupportScreen />);
  await screen.findByText('Thread B');
  expect(
    (screen.getByTestId('support-message-input') as HTMLTextAreaElement).value,
  ).toBe('');
  expect(screen.queryByTestId('support-pending-message')).toBeNull();
  await act(async () =>
    reply.resolve({
      ...part,
      id: 'late-a',
      body: [{ type: 'paragraph', text: 'Late reply A' }],
    }),
  );
  expect(screen.queryByText('Late reply A')).toBeNull();
  await enterMessage('Reply B');
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith(
      'conversations/84/reply',
      expect.any(Object),
    ),
  );
});

it.each(['blur', 'unmount'])(
  'does not mark a late conversation read after %s',
  async (mode) => {
    const loaded = deferred<unknown>();
    mockRoute.params = { userId: null, conversationId: '42' };
    mockRequest.mockImplementation(async (path) => {
      if (path === 'conversations/42') return loaded.promise;
      return {};
    });
    const view = render(<SupportScreen />);
    await waitFor(() =>
      expect(mockRequest).toHaveBeenCalledWith(
        'conversations/42',
        expect.any(Object),
      ),
    );
    if (mode === 'unmount') view.unmount();
    else {
      mockFocused = false;
      view.rerender(<SupportScreen />);
    }
    await act(async () => loaded.resolve({ ...conversation, read: false }));
    expect(mockRequest).not.toHaveBeenCalledWith('conversations/42/read');
  },
);

it('does not acknowledge cached unread data again until a fresh foreground response arrives', async () => {
  const refreshed = deferred<unknown>();
  mockRoute.params = { userId: null, conversationId: '42' };
  let loads = 0;
  mockRequest.mockImplementation(async (path) => {
    if (path === 'conversations/42') {
      loads += 1;
      return loads === 1 ? { ...conversation, read: false } : refreshed.promise;
    }
    return {};
  });
  const view = render(<SupportScreen />);
  await screen.findByText('Hello support');
  await waitFor(() =>
    expect(mockRequest).toHaveBeenCalledWith('conversations/42/read'),
  );
  const readCount = () =>
    mockRequest.mock.calls.filter(([path]) => path === 'conversations/42/read')
      .length;
  expect(readCount()).toBe(1);
  mockFocused = false;
  view.rerender(<SupportScreen />);
  expect(screen.getByText('Hello support')).toBeTruthy();
  mockFocused = true;
  view.rerender(<SupportScreen />);
  await waitFor(() => expect(loads).toBe(2));
  expect(screen.getByText('Hello support')).toBeTruthy();
  expect(readCount()).toBe(1);
  await act(async () => refreshed.resolve({ ...conversation, read: false }));
  await waitFor(() => expect(readCount()).toBe(2));
});

it('keeps loaded inbox pages when focus changes', async () => {
  mockRoute.name = 'IntercomMessages';
  const original = mockRequest.getMockImplementation();
  let pages = 0;
  mockRequest.mockImplementation(async (path, parameters) => {
    if (path === 'conversations') {
      pages += 1;
      return {
        conversation_page: {
          conversations: [{ ...conversation, id: pages === 2 ? '84' : '42' }],
          more_pages_available: pages !== 2,
        },
      };
    }
    return original?.(path, parameters);
  });
  const view = render(<SupportScreen />);
  await screen.findByTestId('support-conversation-42');
  fireEvent.click(screen.getByTestId('support-load-more'));
  await screen.findByTestId('support-conversation-84');
  mockFocused = false;
  view.rerender(<SupportScreen />);
  expect(screen.getByTestId('support-conversation-84')).toBeTruthy();
  mockFocused = true;
  view.rerender(<SupportScreen />);
  await waitFor(() => expect(pages).toBe(3));
  expect(screen.getByTestId('support-conversation-84')).toBeTruthy();
});
