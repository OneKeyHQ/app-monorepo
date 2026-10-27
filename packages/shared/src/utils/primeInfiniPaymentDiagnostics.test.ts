/* cspell:ignore Infini */
import { PrimeSubscriptionScene } from '../logger/scopes/prime/scenes/subscription';

import { getPrimeInfiniPaymentSafeLogParams } from './primeInfiniPaymentDiagnostics';

describe('Infini diagnostics privacy', () => {
  const params = {
    stage: 'responseValidation' as const,
    status: 'failed' as const,
    flowId: 'flow-1',
    paymentId: 'private-payment-identifier',
    paymentSource: 'createResponse' as const,
    failureReason: 'assetMismatch',
    expectedChain: 'BSC',
    expectedToken: 'USDT',
    actualChain: 'SOLANA',
    actualToken: 'USDC',
    remainingMs: -100,
    sessionAgeMs: 200,
    sessionMode: 'quote' as const,
    sendStarted: false,
    hasBeforeBroadcastAction: true,
    isDevModeEnabled: true,
    isAlwaysSignOnlySendTxConfigured: false,
    isSignOnlyRequested: false,
    isExternalAccount: false,
    hasCompletedBeforeBroadcastAction: true,
    hasAttemptedBroadcast: true,
    hasBroadcastTxId: true,
    isWithoutBroadcastTxIdAllowed: false,
    hasPaymentProgress: false,
    createNewPaymentIntent: true,
    authToken: 'secret-auth-token',
    onekeyUserId: 'private-user-id',
    address: '0x1111111111111111111111111111111111111111',
    warningMessages: ['private warning text'],
    errorMessage: 'private warning text',
  };

  test('keeps diagnostic dimensions and only a stable payment hash', () => {
    const safe = getPrimeInfiniPaymentSafeLogParams(params);
    expect(safe).toMatchObject({
      flowId: 'flow-1',
      failureReason: 'assetMismatch',
      expectedChain: 'BSC',
      actualChain: 'SOLANA',
      remainingMs: -100,
      sessionAgeMs: 200,
      sessionMode: 'quote',
      hasBeforeBroadcastAction: true,
      isDevModeEnabled: true,
      isAlwaysSignOnlySendTxConfigured: false,
      isSignOnlyRequested: false,
      isExternalAccount: false,
      hasCompletedBeforeBroadcastAction: true,
      hasAttemptedBroadcast: true,
      hasBroadcastTxId: true,
      isWithoutBroadcastTxIdAllowed: false,
      hasPaymentProgress: false,
    });
    expect(safe.paymentId).toMatch(/^sha256:[a-f0-9]{16}$/);
    expect(safe.paymentId).toBe(
      getPrimeInfiniPaymentSafeLogParams(params).paymentId,
    );
    for (const secret of [
      params.paymentId,
      params.authToken,
      params.onekeyUserId,
      params.address,
      params.warningMessages[0],
    ]) {
      expect(JSON.stringify(safe)).not.toContain(secret);
    }
  });

  test('hashes short identifiers rather than accidentally exposing them intact', () => {
    expect(
      getPrimeInfiniPaymentSafeLogParams({ ...params, paymentId: 'id' })
        .paymentId,
    ).toMatch(/^sha256:[a-f0-9]{16}$/);
  });

  test('sanitizes both scene outputs, including direct background logger callers', () => {
    const scene = new PrimeSubscriptionScene();
    for (const output of [
      scene.primeCryptoPaymentFlow(params),
      scene.primeCryptoPaymentError(params),
    ]) {
      const text = JSON.stringify(output);
      expect(text).toContain('flow-1');
      expect(text).toContain('sha256:');
      for (const secret of [
        params.paymentId,
        params.authToken,
        params.onekeyUserId,
        params.address,
        params.warningMessages[0],
      ]) {
        expect(text).not.toContain(secret);
      }
    }
  });

  test('rejects credential-bearing diagnostic labels', () => {
    const safe = getPrimeInfiniPaymentSafeLogParams({
      ...params,
      actualChain: 'Bearer secret-token',
      actualToken: params.address,
      reason: 'warning: private warning text',
    });
    expect(safe.actualChain).toBeUndefined();
    expect(safe.actualToken).toBeUndefined();
    expect(safe.reason).toBeUndefined();
  });
});
