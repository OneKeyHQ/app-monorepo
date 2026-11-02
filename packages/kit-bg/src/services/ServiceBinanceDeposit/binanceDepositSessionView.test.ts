import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/binanceDeposit';
import type {
  IBinanceDepositAuthorizedDestination,
  IBinanceDepositLocalSession,
  IBinanceDepositSessionView,
} from '@onekeyhq/shared/types/binanceDeposit';

import { mergeView, parseSessionView } from './binanceDepositSessionView';

const SESSION_ID = 'a'.repeat(64);
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

const DESTINATION: IBinanceDepositAuthorizedDestination = {
  networkId: 'evm--42161',
  binanceNetwork: 'ARBITRUM',
  cryptoCurrency: 'USDC',
  contractAddress: USDC_ARB,
  address: '0x1111111111111111111111111111111111111111',
  authorizedAt: 1,
};

function buildSession(
  patch: Partial<IBinanceDepositLocalSession> = {},
): IBinanceDepositLocalSession {
  return {
    localId: 'local-1',
    sessionId: SESSION_ID,
    networkId: 'evm--42161',
    cryptoCurrency: 'USDC',
    contractAddress: USDC_ARB,
    requiresAddressTag: false,
    status: EBinanceDepositSessionStatus.INIT,
    createdAt: 1000,
    updatedAt: 1000,
    ...patch,
  };
}

function buildView(
  patch: Partial<IBinanceDepositSessionView> = {},
): IBinanceDepositSessionView {
  return {
    sessionId: SESSION_ID,
    status: EBinanceDepositSessionStatus.AUTHORIZED,
    networkId: 'evm--42161',
    cryptoCurrency: 'USDC',
    contractAddress: USDC_ARB,
    authorizedDestination: DESTINATION,
    ...patch,
  };
}

describe('parseSessionView', () => {
  it('reads a well-formed view and keeps a numeric minimum as a string', () => {
    const view = parseSessionView({
      ...buildView(),
      authorizedDestination: { ...DESTINATION, minAmount: 0.5 },
    });

    expect(view?.status).toBe(EBinanceDepositSessionStatus.AUTHORIZED);
    expect(view?.authorizedDestination?.minAmount).toBe('0.5');
  });

  it('rejects a session id that is not 64 lowercase hex characters', () => {
    expect(parseSessionView(buildView({ sessionId: 'A'.repeat(64) }))).toBe(
      undefined,
    );
    expect(parseSessionView(buildView({ sessionId: '../query' }))).toBe(
      undefined,
    );
  });

  it('rejects a view of another session', () => {
    expect(parseSessionView(buildView(), 'b'.repeat(64))).toBe(undefined);
  });

  it('rejects a status the client does not know', () => {
    expect(
      parseSessionView({ ...buildView(), status: 'CANCELLED' }),
    ).toBeUndefined();
  });

  it('drops a destination without an address', () => {
    const view = parseSessionView({
      ...buildView(),
      authorizedDestination: { ...DESTINATION, address: '' },
    });

    expect(view?.authorizedDestination).toBeUndefined();
  });
});

describe('mergeView', () => {
  it('ignores a view that arrived late with an earlier status', () => {
    const session = buildSession({
      status: EBinanceDepositSessionStatus.AUTHORIZED,
      destination: DESTINATION,
    });

    expect(
      mergeView(
        session,
        buildView({ status: EBinanceDepositSessionStatus.INIT }),
      ),
    ).toBe(session);
  });

  it('never revives a failed session', () => {
    const session = buildSession({ failReason: 'expired' });

    expect(mergeView(session, buildView())).toBe(session);
  });

  it('fails a view of another asset as a conflict', () => {
    const merged = mergeView(
      buildSession(),
      buildView({ cryptoCurrency: 'USDT' }),
    );

    expect(merged.failReason).toBe('conflict');
    expect(merged.destination).toBeUndefined();
  });

  it('fails an INIT view whose link leaves the allowlist as a conflict', () => {
    const merged = mergeView(
      buildSession({ status: 'LOCAL_PENDING_CREATE' }),
      buildView({
        status: EBinanceDepositSessionStatus.INIT,
        link: 'https://binance.example.com/deposit',
      }),
    );

    expect(merged.failReason).toBe('conflict');
  });

  it('keeps the link expiry of an INIT view', () => {
    const merged = mergeView(
      buildSession({ status: 'LOCAL_PENDING_CREATE' }),
      buildView({
        status: EBinanceDepositSessionStatus.INIT,
        link: 'https://app.binance.com/deposit?x=1',
        linkExpireTime: 5000,
      }),
    );

    expect(merged.status).toBe(EBinanceDepositSessionStatus.INIT);
    expect(merged.linkExpireTime).toBe(5000);
    expect(merged.failReason).toBeUndefined();
  });

  it('keeps the bind deadline of an unbound authorization', () => {
    const merged = mergeView(
      buildSession(),
      buildView({
        status: EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND,
        authorizedDestination: undefined,
        bindDeadline: 9000,
      }),
    );

    expect(merged.bindDeadline).toBe(9000);
    expect(merged.destination).toBeUndefined();
  });

  it('takes the released destination', () => {
    const merged = mergeView(buildSession(), buildView());

    expect(merged.status).toBe(EBinanceDepositSessionStatus.AUTHORIZED);
    expect(merged.destination).toEqual(DESTINATION);
  });

  it('requires the address tag when the asset needs one', () => {
    const merged = mergeView(
      buildSession({ requiresAddressTag: true }),
      buildView(),
    );

    expect(merged.failReason).toBe('conflict');
  });

  it('fails a destination that differs from the one already released', () => {
    const merged = mergeView(
      buildSession({
        status: EBinanceDepositSessionStatus.AUTHORIZED,
        destination: DESTINATION,
      }),
      buildView({
        authorizedDestination: {
          ...DESTINATION,
          address: '0x2222222222222222222222222222222222222222',
        },
      }),
    );

    expect(merged.failReason).toBe('conflict');
    expect(merged.destination).toBeUndefined();
  });

  it.each([
    [EBinanceDepositSessionStatus.REJECTED, 'rejected'],
    [EBinanceDepositSessionStatus.EXPIRED, 'expired'],
    [EBinanceDepositSessionStatus.SECURITY_CONFLICT, 'conflict'],
  ])('ends a %s session as %s', (status, failReason) => {
    const merged = mergeView(buildSession(), buildView({ status }));

    expect(merged.failReason).toBe(failReason);
  });
});
