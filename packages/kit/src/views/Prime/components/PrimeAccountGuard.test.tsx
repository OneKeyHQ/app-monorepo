/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { PrimeAccountGuard } from './PrimeAccountGuard';

let mockIsBanned = true;
const mockPush = jest.fn();
const mockLogout = jest.fn();
const mockProtectedMount = jest.fn();

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [{ isOneKeyIdBanned: mockIsBanned }],
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout',
  () => ({
    useConfirmOneKeyIdLogout: () => mockLogout,
  }),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Container({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  }
  return {
    Page: Object.assign(Container, { Header: Container, Body: Container }),
    YStack: Container,
    SizableText: Container,
    Button: ({
      children,
      onPress,
    }: {
      children: ReactNode;
      onPress: () => void;
    }) => React.createElement('button', { onClick: onPress }, children),
    resetPrimeModal: jest.fn(),
  };
});

function ProtectedContent() {
  mockProtectedMount();
  return <div>Account features</div>;
}

describe('PrimeAccountGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBanned = true;
  });

  it('replaces restricted features before mounting them and keeps deletion available', () => {
    render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(mockProtectedMount).not.toHaveBeenCalled();
    expect(
      screen.getByText('error__service_prime_user_banned_error'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText(ETranslations.id_delete_onekey_id));
    expect(mockPush).toHaveBeenCalledWith(EPrimePages.PrimeDeleteAccount);
    fireEvent.click(screen.getByText(ETranslations.prime_log_out));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders normal users and responds to an identity change', () => {
    mockIsBanned = false;
    const view = render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
    mockIsBanned = true;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.queryByText('Account features')).toBeNull();
    mockIsBanned = false;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
  });
});
