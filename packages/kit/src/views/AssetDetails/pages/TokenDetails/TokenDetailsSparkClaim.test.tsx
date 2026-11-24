/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, cleanup, fireEvent, render } from '@testing-library/react';

import TokenDetailsSparkClaim from './TokenDetailsSparkClaim';

const mockClaimPendingReceive = jest.fn<Promise<void>, [unknown]>();
const mockToastSuccess = jest.fn<void, [unknown]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const passThrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    Button: ({
      testID,
      onPress,
      children,
    }: {
      testID: string;
      onPress: () => Promise<void>;
      children?: ReactNode;
    }) => (
      <button type="button" data-testid={testID} onClick={() => onPress()}>
        {children}
      </button>
    ),
    SizableText: passThrough,
    XStack: passThrough,
    Toast: { success: (params: unknown) => mockToastSuccess(params) },
  };
});
jest.mock('@onekeyhq/kit/src/components/NumberSizeableTextWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceLightningSpark: {
      claimPendingReceive: (params: unknown) => mockClaimPendingReceive(params),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { AccountDataUpdate: 'AccountDataUpdate' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

function renderClaim(pendingReceiveSats: string) {
  const props = {
    accountId: 'account-1',
    networkId: 'lightningspark--0',
    symbol: 'SATS',
    onRefresh: jest.fn(),
  };
  const view = render(
    <TokenDetailsSparkClaim
      {...props}
      pendingReceiveSats={pendingReceiveSats}
    />,
  );
  return {
    ...view,
    refreshTo: (sats: string) =>
      view.rerender(
        <TokenDetailsSparkClaim {...props} pendingReceiveSats={sats} />,
      ),
  };
}

async function pressClaim(view: ReturnType<typeof renderClaim>) {
  await act(async () => {
    fireEvent.click(view.getByTestId('asset-details-spark-claim-btn'));
  });
}

describe('TokenDetailsSparkClaim', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClaimPendingReceive.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('does not report a claim while the refreshed amount is still pending', async () => {
    const view = renderClaim('1000');

    await pressClaim(view);
    view.refreshTo('1000');

    expect(mockClaimPendingReceive).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'lightningspark--0',
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(view.queryByTestId('asset-details-spark-claim-btn')).not.toBeNull();
  });

  it('reports the claim once the refreshed account data has nothing pending', async () => {
    const view = renderClaim('1000');

    await pressClaim(view);
    view.refreshTo('0');

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith({ title: 'earn.claimed' });
    expect(view.queryByTestId('asset-details-spark-claim-btn')).toBeNull();
  });

  it('does not report a claim it did not start', () => {
    const view = renderClaim('1000');

    view.refreshTo('0');

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
