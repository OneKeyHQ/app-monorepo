import { CreateOrderScene } from './createOrder';
import { ESwapEventAPIStatus, SwapEstimateFeeScene } from './swapEstimateFee';
import { SwapReviewScene } from './swapReview';
import { SwapSendTxScene } from './swapSendTx';

const identity = {
  reviewSessionId: 'review-session',
  quoteId: 'quote-id',
};

describe('Swap Review server events', () => {
  it('emits exactly the four Jira event names through the server transport', () => {
    const scene = new SwapReviewScene();
    const emit = jest
      .spyOn(scene, '_emitLog')
      .mockImplementation(() => undefined);
    scene.swapReviewOpen({
      ...identity,
      swapProvider: 'provider',
      swapType: 'swap',
      sourceChain: 'evm--1',
      receivedChain: 'evm--1',
      sourceTokenSymbol: 'ETH',
      receivedTokenSymbol: 'USDC',
      createFrom: 'swapPage',
      walletType: 'hd',
      supportPreBuild: true,
      needApprove: false,
      openDelayMs: 101,
    });
    scene.swapReviewReady({
      ...identity,
      orderId: 'service-order',
      status: 'ready',
      supportPreBuild: true,
      totalMs: 500,
      buildTxMs: 300,
    });
    scene.swapReviewConfirm({
      ...identity,
      orderId: 'service-order',
      sinceOpenMs: 1000,
      sinceReadyMs: 500,
    });
    scene.swapReviewClose({
      ...identity,
      closeStage: 'ready',
      closeReason: 'user',
      sinceOpenMs: 1000,
    });

    expect(emit.mock.calls.map(([name]) => name)).toEqual([
      'swapReviewOpen',
      'swapReviewReady',
      'swapReviewConfirm',
      'swapReviewClose',
    ]);
    for (const [, payloads, metadata] of emit.mock.calls) {
      expect(payloads).toEqual([expect.objectContaining(identity)]);
      expect(metadata).toEqual([{ type: 'server', level: 'info' }]);
    }
    expect(emit.mock.calls[1][1]).toEqual([
      expect.objectContaining({ orderId: 'service-order', buildTxMs: 300 }),
    ]);
  });

  it.each([
    undefined,
    'private-account 0x1111111111111111111111111111111111111111 payload=private-transaction',
    'RPC failed at https://private.invalid?token=private-access password=private-credential',
    'Network error with private-arbitrary-suffix',
  ])(
    'retains correlation fields without exposing error or transaction data: %s',
    (message) => {
      const create = new CreateOrderScene();
      const estimate = new SwapEstimateFeeScene();
      const send = new SwapSendTxScene();
      const review = new SwapReviewScene();
      const emitReview = jest
        .spyOn(review, '_emitLog')
        .mockImplementation(() => undefined);
      const emitCreate = jest
        .spyOn(create, '_emitLog')
        .mockImplementation(() => undefined);
      const emitEstimate = jest
        .spyOn(estimate, '_emitLog')
        .mockImplementation(() => undefined);
      const emitSend = jest
        .spyOn(send, '_emitLog')
        .mockImplementation(() => undefined);
      const execution = {
        ...identity,
        orderId: 'service-order',
        swapType: 'swap',
        status: ESwapEventAPIStatus.SUCCESS,
        message,
        slippage: '0.5',
        provider: 'provider',
        providerName: 'Provider',
        fromNetworkId: 'evm--1',
        toNetworkId: 'evm--1',
        fromTokenSymbol: 'ETH',
        toTokenSymbol: 'USDC',
        fromTokenAmount: '1',
        toTokenAmount: '2000',
        networkId: 'evm--1',
        accountId: 'private-account',
        encodedTx: 'private-transaction',
        fromAddress: 'private-sender',
        toAddress: 'private-receiver',
      };
      create.swapCreateOrder({
        ...execution,
        isPreBuild: true,
        sourceChain: execution.fromNetworkId,
        receivedChain: execution.toNetworkId,
        sourceTokenSymbol: execution.fromTokenSymbol,
        receivedTokenSymbol: execution.toTokenSymbol,
        swapProvider: execution.provider,
        swapProviderName: execution.providerName,
        feeType: '0',
        isFirstTime: false,
        createFrom: 'swapPage',
        walletType: 'hd',
        deviceType: undefined,
      });
      estimate.swapEstimateFee({ ...execution, isBatch: true });
      send.swapSendTx(execution);
      review.swapReviewReady({
        ...identity,
        status: 'error',
        totalMs: 10,
        supportPreBuild: true,
        message,
      });

      for (const emit of [emitCreate, emitEstimate, emitSend, emitReview]) {
        const payload = emit.mock.calls[0][1][0] as { message?: string };
        let expectedMessage: string | undefined;
        if (message !== undefined) {
          expectedMessage =
            message.includes('RPC') || message.includes('Network')
              ? 'Network error'
              : 'Unknown error';
        }
        expect(payload.message).toBe(expectedMessage);
        expect(JSON.stringify(payload)).not.toContain('0x1111');
        expect(emit).toHaveBeenCalledTimes(1);
        const [, payloads, metadata] = emit.mock.calls[0];
        expect(payloads).toEqual([expect.objectContaining(identity)]);
        expect(metadata).toContainEqual({ type: 'server', level: 'info' });
        expect(JSON.stringify(payloads)).not.toContain('private-');
      }
      expect(emitCreate.mock.calls[0][1]).toEqual([
        expect.objectContaining({ isPreBuild: true }),
      ]);
      expect(emitEstimate.mock.calls[0][1]).toEqual([
        expect.objectContaining({ isBatch: true }),
      ]);
    },
  );
});
