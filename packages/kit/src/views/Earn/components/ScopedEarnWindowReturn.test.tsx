/** @jest-environment jsdom */
import { render } from '@testing-library/react';

import { ScopedEarnWindowReturn } from './ScopedEarnWindowReturn';

const mockUseEarnAccount = jest.fn<unknown, [unknown]>();
const mockUseEarnWindowScope = jest.fn<unknown, [unknown]>();
const mockUseEarnWindowReturn = jest.fn<void, [unknown]>();

jest.mock('../../Staking/hooks/useEarnAccount', () => ({
  useEarnAccount: (options: unknown) => mockUseEarnAccount(options),
}));
jest.mock('../earnWindowReturn', () => ({
  useEarnWindowScope: (scope: unknown) => mockUseEarnWindowScope(scope),
  useEarnWindowReturn: (scope: unknown) => mockUseEarnWindowReturn(scope),
  matchesEarnWindowScope: (
    a: { accountId?: string; anonymous?: true; networkId: string },
    b?: { accountId?: string; anonymous?: true; networkId: string },
  ) =>
    Boolean(
      b &&
      a.networkId === b.networkId &&
      (a.anonymous ? b.anonymous : a.accountId === b.accountId),
    ),
}));

describe('ScopedEarnWindowReturn', () => {
  beforeEach(() => {
    mockUseEarnAccount.mockReset();
    mockUseEarnWindowScope.mockReset();
    mockUseEarnWindowReturn.mockReset();
  });

  it('only claims the return for the currently selected account on its network', () => {
    const scope = { accountId: 'account-a', networkId: 'evm--1' };
    mockUseEarnAccount.mockReturnValue({ earnAccount: undefined });
    mockUseEarnWindowScope.mockReturnValue(undefined);
    const view = render(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnAccount).toHaveBeenLastCalledWith({
      networkId: 'evm--1',
    });
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(undefined);

    mockUseEarnAccount.mockReturnValue({
      earnAccount: {
        account: { id: 'account-a', indexedAccountId: 'index-a' },
      },
    });
    mockUseEarnWindowScope.mockReturnValue(scope);
    view.rerender(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(scope);
    expect(mockUseEarnWindowScope).toHaveBeenLastCalledWith({
      accountId: 'account-a',
      indexedAccountId: 'index-a',
      networkId: 'evm--1',
    });

    mockUseEarnAccount.mockReturnValue({
      earnAccount: { account: { id: 'account-b' } },
    });
    mockUseEarnWindowScope.mockReturnValue({
      accountId: 'account-b',
      networkId: 'evm--1',
    });
    view.rerender(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(undefined);
  });

  it('claims anonymous returns only when the current selector resolves as anonymous', () => {
    const scope = { anonymous: true, networkId: 'evm--1' } as const;
    mockUseEarnAccount.mockReturnValue({ earnAccount: undefined });
    mockUseEarnWindowScope.mockReturnValue(undefined);
    const view = render(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(undefined);

    mockUseEarnWindowScope.mockReturnValue(scope);
    view.rerender(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(scope);

    mockUseEarnWindowScope.mockReturnValue({
      accountId: 'account-a',
      networkId: 'evm--1',
    });
    view.rerender(<ScopedEarnWindowReturn scope={scope} />);
    expect(mockUseEarnWindowReturn).toHaveBeenLastCalledWith(undefined);
  });
});
