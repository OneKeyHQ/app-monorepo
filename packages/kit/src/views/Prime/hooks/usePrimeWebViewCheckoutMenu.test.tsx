/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { act, cleanup, render, renderHook } from '@testing-library/react';
import { createIntl } from 'react-intl';

import type { IActionListProps } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePrimeWebViewCheckoutMenu } from './usePrimeWebViewCheckoutMenu';

import type { IWebViewRef } from '../../../components/WebView/types';

const mockActionList = jest.fn<null, [unknown]>(() => null);
const mockHeaderButton = jest.fn<null, [unknown]>(() => null);
const mockCurrentUser = jest.fn(async (_id: string) => true);
let mockBeforeRemove: (() => void) | undefined;
const mockNavigation = {
  addListener: jest.fn((_event: string, listener: () => void) => {
    mockBeforeRemove = listener;
    return jest.fn();
  }),
};
let mockDialog: IDialogShowProps | undefined;
const mockClose = jest.fn(async () => {
  await mockDialog?.onClose?.();
});
jest.mock('@onekeyhq/components', () => ({
  ActionList: (props: IActionListProps) => {
    mockActionList(props);
    return props.renderTrigger;
  },
  HeaderIconButton: (props: unknown) => mockHeaderButton(props),
  Dialog: {
    show: (props: IDialogShowProps) => {
      mockDialog = props;
      return { close: mockClose };
    },
  },
}));
jest.mock('@react-navigation/core', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('./primeWebCheckout', () => ({
  isPrimeWebCheckoutUserCurrent: (id: string) => mockCurrentUser(id),
}));

const intl = createIntl({
  locale: 'en',
  onError: () => undefined,
});
const sendMessageViaInjectedScript = jest.fn();
const instance = {
  sendMessageViaInjectedScript,
} as unknown as IWebViewRef;
function mount() {
  const hook = renderHook(() =>
    usePrimeWebViewCheckoutMenu({
      enabled: true,
      routeKey: 'route',
      primeUserId: 'user',
      intl,
    }),
  );
  act(() => {
    hook.result.current.onInstanceRef(instance);
    hook.result.current.handoff.receiveState({
      checkoutId: hook.result.current.checkoutId,
      attemptId: 'attempt',
      revision: 1,
      canSwitch: true,
    });
  });
  const menu = () => {
    const element =
      hook.result.current.headerRight() as ReactElement<IActionListProps>;
    render(element);
    return element.props.sections?.[0]?.items?.[0];
  };
  return { ...hook, menu };
}
async function confirm() {
  await mockDialog?.onConfirm?.({
    close: mockClose,
    preventClose: jest.fn(),
    getForm: () => undefined,
    isExist: () => true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDialog = undefined;
  mockCurrentUser.mockResolvedValue(true);
});
afterEach(cleanup);

it('renders only the browser payment action with shared translations and accessibility label', () => {
  const { menu } = mount();
  const item = menu();
  expect(item).toMatchObject({
    label: ETranslations.explore_open_in_browser,
    disabled: false,
    testID: 'prime-checkout-open-browser',
  });
  expect(mockHeaderButton).toHaveBeenCalledWith(
    expect.objectContaining({
      accessibilityLabel: ETranslations.explore_options,
      testID: 'prime-checkout-menu',
    }),
  );
  const props = mockActionList.mock.calls.at(
    -1,
  )?.[0] as unknown as IActionListProps;
  expect(props.sections?.[0]?.items).toHaveLength(1);
  act(() => {
    void item?.onPress?.(jest.fn());
  });
  expect(mockDialog).toMatchObject({
    title: ETranslations.explore_open_in_browser,
    description: ETranslations.prime_external_wallet_checkout__desc,
    onConfirmText: ETranslations.global_continue,
    showCancelButton: true,
  });
});

it('leaves the form alone when confirmation is cancelled and rejects repeated clicks', async () => {
  const { menu } = mount();
  const item = menu();
  act(() => {
    void item?.onPress?.(jest.fn());
    void item?.onPress?.(jest.fn());
  });
  expect(menu()?.disabled).toBe(true);
  await act(async () => {
    await mockClose();
  });
  expect(menu()?.disabled).toBe(false);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
});

it('sends cancellation only to its own instance after confirmation', async () => {
  const { menu, result } = mount();
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  await act(confirm);
  expect(mockCurrentUser).toHaveBeenCalledWith('user');
  expect(sendMessageViaInjectedScript).toHaveBeenCalledTimes(1);
  expect(sendMessageViaInjectedScript).toHaveBeenCalledWith(
    expect.objectContaining({
      checkoutId: result.current.checkoutId,
      attemptId: 'attempt',
    }),
  );
});

it('refuses a stale confirmation when submission or completion occurs during identity validation', async () => {
  const { menu, result } = mount();
  let release: ((value: boolean) => void) | undefined;
  mockCurrentUser.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  let confirmation: Promise<void> | undefined;
  act(() => {
    confirmation = confirm();
  });
  act(() => {
    result.current.handoff.receiveState({
      checkoutId: result.current.checkoutId,
      attemptId: 'attempt',
      revision: 2,
      canSwitch: false,
    });
  });
  await act(async () => {
    release?.(true);
    await confirmation;
  });
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
});

it('blocks cancellation after an account switch', async () => {
  const { menu } = mount();
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  mockCurrentUser.mockResolvedValue(false);
  await act(confirm);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  expect(menu()?.disabled).toBe(true);
});

it('revokes a confirmation when the native modal closes or goes back', async () => {
  const { menu } = mount();
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  act(() => {
    mockBeforeRemove?.();
  });
  await act(confirm);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
});

it('retains the form across React ref reattachment and targets the current instance', async () => {
  const { menu, result } = mount();
  const currentSend = jest.fn();
  act(() => {
    result.current.onInstanceRef(null);
    result.current.onInstanceRef({
      sendMessageViaInjectedScript: currentSend,
    } as unknown as IWebViewRef);
  });
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  await act(confirm);
  expect(currentSend).toHaveBeenCalledTimes(1);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
});

it('invalidates pending confirmation on a new navigation and on unmount', async () => {
  const { menu, result, unmount } = mount();
  act(() => {
    void menu()?.onPress?.(jest.fn());
  });
  act(() => {
    result.current.onLoadStart({ nativeEvent: { loading: true } } as Parameters<
      NonNullable<typeof result.current.onLoadStart>
    >[0]);
  });
  await act(confirm);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  unmount();
  await act(confirm);
  expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
});
