/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */

import type { ReactNode } from 'react';

import { showRenameDialog } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

const dialogShowMock = jest.fn();
const selectPropsMock = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Dialog = Object.assign(Wrapper, {
    show: (...args: unknown[]) => {
      dialogShowMock(...args);
      return { close: jest.fn() };
    },
    Form: Wrapper,
    FormField: Wrapper,
  });
  return {
    Button: Wrapper,
    Dialog,
    Form: { FieldDescription: Wrapper },
    Input: ({ addOns }: { addOns?: { onPress?: () => void }[] }) =>
      addOns?.map((addOn, index) => (
        <button
          key={index}
          aria-label={`Input addon ${index}`}
          data-testid={`input-addon-${index}`}
          onClick={addOn.onPress}
          type="button"
        />
      )),
    Select: (props: { nativeSheet?: boolean }) => {
      selectPropsMock(props);
      return <div data-testid="v4-name-selector" />;
    },
    Stack: Wrapper,
    Toast: { success: jest.fn() },
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: true }),
}));
jest.mock('../NetworkAvatar', () => ({ NetworkAvatar: () => null }));
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/consts/v4CoinTypeToNetworkId', () => ({
  v4CoinTypeToNetworkId: {},
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
  },
}));

describe('RenameDialog native sheet nesting', () => {
  beforeEach(() => {
    dialogShowMock.mockReset();
    selectPropsMock.mockReset();
  });

  it('keeps nested history and V4 selectors in the native presentation stack', () => {
    const intl = {
      formatMessage: ({ id }: { id: string }) => id,
    };
    const indexedAccount = { id: 'indexed-account-1' };
    const nameHistoryInfo = {
      entityId: indexedAccount.id,
      entityType: 'IndexedAccount',
      contentType: 'Name',
    };

    showRenameDialog('Account', {
      nativeSheet: true,
      intl: intl as never,
      indexedAccount: indexedAccount as never,
      nameHistoryInfo: nameHistoryInfo as never,
      onSubmit: async () => undefined,
    });

    const renameDialogProps = dialogShowMock.mock.calls[0][0] as {
      nativeSheet?: boolean;
      renderContent: ReactNode;
    };
    expect(renameDialogProps.nativeSheet).toBe(true);

    render(renameDialogProps.renderContent);
    expect(screen.getByTestId('v4-name-selector')).toBeTruthy();
    expect(selectPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({ nativeSheet: true }),
    );

    fireEvent.click(screen.getByTestId('input-addon-0'));
    const historyDialogProps = dialogShowMock.mock.calls[1][0] as {
      nativeSheet?: boolean;
    };
    expect(historyDialogProps.nativeSheet).toBe(true);
  });
});
