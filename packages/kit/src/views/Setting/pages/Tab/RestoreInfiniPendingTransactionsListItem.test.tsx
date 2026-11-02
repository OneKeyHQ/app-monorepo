/** @jest-environment jsdom */
/* cspell:ignore Infini */
import { fireEvent, render, waitFor } from '@testing-library/react';

import { RestoreInfiniPendingTransactionsListItem } from './RestoreInfiniPendingTransactionsListItem';

const mockShow = jest.fn<void, [{ onConfirm?: () => Promise<void> }]>();
const mockRecoveries = jest
  .fn<Promise<{ nonce: number }[]>, []>()
  .mockResolvedValue([{ nonce: 5 }]);
const mockRestore = jest.fn<Promise<number>, []>().mockResolvedValue(1);
const mockSuccess = jest.fn<void, []>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (options: { onConfirm?: () => Promise<void> }) => mockShow(options),
  },
  Toast: { success: () => mockSuccess() },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      prime: { getInfiniPendingTransactionRecoveries: () => mockRecoveries() },
    },
    serviceSend: { restoreInfiniPendingTransactions: () => mockRestore() },
  },
}));
jest.mock('./ListItem', () => ({
  TabSettingsListItem: ({ onPress }: { onPress: () => Promise<void> }) => (
    <button type="button" onClick={onPress}>
      restore
    </button>
  ),
}));

describe('Infini recovery settings entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoveries.mockResolvedValue([{ nonce: 5 }]);
  });

  it('requires the user to confirm restoration and delegates only to the history recovery method', async () => {
    const screen = render(<RestoreInfiniPendingTransactionsListItem />);
    expect(mockRecoveries).not.toHaveBeenCalled();
    expect(mockRestore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledTimes(1));
    expect(mockRestore).not.toHaveBeenCalled();
    await mockShow.mock.calls[0][0].onConfirm?.();
    expect(mockRestore).toHaveBeenCalledTimes(1);
    expect(mockSuccess).toHaveBeenCalledTimes(1);
  });

  it('has no restore action when there are no protected transactions', async () => {
    mockRecoveries.mockResolvedValue([]);
    const screen = render(<RestoreInfiniPendingTransactionsListItem />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mockShow).toHaveBeenCalledTimes(1));
    expect(mockShow.mock.calls[0][0].onConfirm).toBeUndefined();
    expect(mockRestore).not.toHaveBeenCalled();
  });
});
