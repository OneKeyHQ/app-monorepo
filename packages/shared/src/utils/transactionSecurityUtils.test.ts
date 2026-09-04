import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import { ETransactionSecurityResultCode } from '@onekeyhq/shared/types/transactionSecurity';

import {
  buildTransactionSecurityJsonRpc,
  canAttemptTransactionSecurityEncodedTx,
  canSubmitTransactionSecurityEncodedTx,
  canSubmitTransactionSecurityJsonRpc,
  createCheckFailedTransactionSecurityResult,
  createCheckUnavailableTransactionSecurityResult,
  createNetworkNotSupportedTransactionSecurityResult,
  createUnableToAssessTransactionSecurityResult,
  getTransactionSecurityEncodedTxIdentity,
  isTransactionSecurityCheckFailed,
  isTransactionSecurityCheckUnavailable,
  isTransactionSecurityNetworkNotSupported,
  mergeTransactionSecurityResults,
  normalizeTransactionSecurityLevel,
  normalizeTransactionSecurityResult,
  resolveTransactionSecurityServerResult,
  sortTransactionSecurityFeatures,
} from './transactionSecurityUtils';

describe('transactionSecurityUtils', () => {
  describe('normalizeTransactionSecurityLevel', () => {
    it.each([
      ['high', EHostSecurityLevel.High],
      ['Malicious', EHostSecurityLevel.High],
      ['medium', EHostSecurityLevel.Medium],
      ['Warning', EHostSecurityLevel.Medium],
      ['security', EHostSecurityLevel.Security],
      ['Benign', EHostSecurityLevel.Security],
      ['unknown', EHostSecurityLevel.Unknown],
      ['Info', EHostSecurityLevel.Unknown],
      [undefined, EHostSecurityLevel.Unknown],
    ])('maps %s', (value, expected) => {
      expect(normalizeTransactionSecurityLevel(value)).toBe(expected);
    });
  });

  describe('normalizeTransactionSecurityResult', () => {
    it('accepts the live utility response shape', () => {
      expect(
        normalizeTransactionSecurityResult({
          level: 'high',
          detail: {
            code: 'known_malicious_interaction',
            title: 'Address flagged for malicious activity',
            content: 'An address in this transaction is associated with risk.',
            features: [],
          },
        }),
      ).toEqual({
        level: EHostSecurityLevel.High,
        detail: {
          code: 'known_malicious_interaction',
          title: 'Address flagged for malicious activity',
          content: 'An address in this transaction is associated with risk.',
          features: [],
        },
      });
    });

    it('accepts the older summaryCode / type payload', () => {
      const result = normalizeTransactionSecurityResult({
        level: 'Malicious',
        detail: {
          summaryCode: 'known_malicious_interaction',
          features: [
            {
              type: 'Malicious',
              code: 'KNOWN_MALICIOUS_ADDRESS',
              address: '0xabc',
            },
          ],
        },
      });
      expect(result?.detail.code).toBe('known_malicious_interaction');
      expect(result?.detail.features).toEqual([
        {
          level: EHostSecurityLevel.High,
          code: 'KNOWN_MALICIOUS_ADDRESS',
          address: '0xabc',
        },
      ]);
    });

    it('keeps the server summary authoritative over feature severities', () => {
      const result = normalizeTransactionSecurityResult({
        level: 'security',
        detail: {
          code: 'benign',
          features: [{ code: 'INFO_ONLY', level: 'high' }],
        },
      });

      expect(result?.level).toBe(EHostSecurityLevel.Security);
      expect(result?.detail.features[0]?.level).toBe(EHostSecurityLevel.High);
    });

    it('returns undefined for an empty payload', () => {
      expect(normalizeTransactionSecurityResult({})).toBeUndefined();
    });

    it('does not accept an incomplete safe response as conclusive', () => {
      expect(
        resolveTransactionSecurityServerResult({
          level: 'security',
          detail: {
            features: [{ code: 'INFO', level: 'security' }],
          },
        }),
      ).toEqual(createUnableToAssessTransactionSecurityResult());
    });

    it.each([
      ETransactionSecurityResultCode.UnableToAssess,
      ETransactionSecurityResultCode.CheckFailed,
    ])('does not accept %s as a safe result', (code) => {
      expect(
        resolveTransactionSecurityServerResult({
          level: 'security',
          detail: {
            code,
            title: 'Server detail',
            features: [],
          },
        }),
      ).toMatchObject({
        level: EHostSecurityLevel.Unknown,
        detail: {
          code,
          title: 'Server detail',
          features: [],
        },
      });
    });

    it('returns undefined when the server says the check is not applicable', () => {
      expect(
        normalizeTransactionSecurityResult({
          supported: false,
          detail: { code: ETransactionSecurityResultCode.NotSupported },
        }),
      ).toBeUndefined();
      expect(
        normalizeTransactionSecurityResult({
          detail: { code: 'NOT_SUPPORTED' },
        }),
      ).toBeUndefined();
      expect(createUnableToAssessTransactionSecurityResult()).toEqual({
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.UnableToAssess,
          features: [],
        },
      });
      expect(createCheckFailedTransactionSecurityResult()).toEqual({
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.CheckFailed,
          features: [],
        },
      });
      expect(
        isTransactionSecurityCheckFailed(
          createCheckFailedTransactionSecurityResult(),
        ),
      ).toBe(true);
      expect(
        isTransactionSecurityCheckFailed(
          createUnableToAssessTransactionSecurityResult(),
        ),
      ).toBe(false);
      expect(
        isTransactionSecurityCheckUnavailable(
          createCheckUnavailableTransactionSecurityResult(),
        ),
      ).toBe(true);
      expect(
        isTransactionSecurityNetworkNotSupported(
          createNetworkNotSupportedTransactionSecurityResult(),
        ),
      ).toBe(true);
      expect(
        resolveTransactionSecurityServerResult({
          supported: false,
          detail: { code: ETransactionSecurityResultCode.NotSupported },
        }),
      ).toBeUndefined();
      expect(resolveTransactionSecurityServerResult({})).toEqual(
        createUnableToAssessTransactionSecurityResult(),
      );
    });
  });

  describe('canSubmitTransactionSecurity payload', () => {
    it('accepts EVM-shaped objects and encoded strings', () => {
      expect(
        canSubmitTransactionSecurityEncodedTx({
          to: '0x1',
          data: '0x',
          value: '0x0',
        }),
      ).toBe(true);
      expect(
        canSubmitTransactionSecurityEncodedTx({
          from: '0x2',
          to: '0x1',
          data: '0x',
          value: '0x1',
        }),
      ).toBe(true);
      expect(canSubmitTransactionSecurityEncodedTx('3md7BBV9wFjY')).toBe(true);
      expect(
        canAttemptTransactionSecurityEncodedTx({
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x5208',
        }),
      ).toBe(true);
      expect(
        getTransactionSecurityEncodedTxIdentity({
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x5208',
        }),
      ).toBe(
        getTransactionSecurityEncodedTxIdentity({
          to: '0x1',
          data: '0x',
          value: '0x0',
          gas: '0x61a8',
        }),
      );
      expect(
        getTransactionSecurityEncodedTxIdentity({
          to: '0x1',
          value: { amount: '1', token: 'USDC' },
        }),
      ).toBe(
        getTransactionSecurityEncodedTxIdentity({
          value: { token: 'USDC', amount: '1' },
          to: '0x1',
        }),
      );
    });

    it('rejects native objects that the live schema will 422', () => {
      expect(
        canSubmitTransactionSecurityEncodedTx({
          visible: true,
          raw_data: { contract: [] },
        }),
      ).toBe(false);
      expect(
        canSubmitTransactionSecurityEncodedTx({
          inputs: [],
          outputs: [],
        }),
      ).toBe(false);
      expect(canSubmitTransactionSecurityEncodedTx({})).toBe(false);
      expect(canSubmitTransactionSecurityEncodedTx('')).toBe(false);
      expect(
        canAttemptTransactionSecurityEncodedTx({
          visible: true,
          raw_data: { contract: [] },
        }),
      ).toBe(false);
    });

    it('accepts only the live jsonRpc method allowlist', () => {
      expect(
        canSubmitTransactionSecurityJsonRpc({
          method: 'personal_sign',
          params: ['0x1'],
        }),
      ).toBe(true);
      expect(
        canSubmitTransactionSecurityJsonRpc({
          method: 'eth_signTypedData_v4',
          params: ['0x1', '{}'],
        }),
      ).toBe(true);
      expect(
        canSubmitTransactionSecurityJsonRpc({
          method: 'solana_signTransaction',
          params: ['payload'],
        }),
      ).toBe(false);
    });
  });

  describe('sortTransactionSecurityFeatures', () => {
    it('sorts by risk and keeps server order within the same level', () => {
      const sorted = sortTransactionSecurityFeatures([
        { level: EHostSecurityLevel.Unknown, code: 'info-1', title: 'Info 1' },
        { level: EHostSecurityLevel.High, code: 'high-1', title: 'High 1' },
        {
          level: EHostSecurityLevel.Medium,
          code: 'medium-1',
          title: 'Medium 1',
        },
        { level: EHostSecurityLevel.High, code: 'high-2', title: 'High 2' },
        {
          level: EHostSecurityLevel.Security,
          code: 'safe-1',
          title: 'Safe 1',
        },
      ]);
      expect(sorted.map((feature) => feature.code)).toEqual([
        'high-1',
        'high-2',
        'medium-1',
        'info-1',
        'safe-1',
      ]);
    });
  });

  describe('mergeTransactionSecurityResults', () => {
    it('uses the highest-risk summary and merges unique features', () => {
      const approval = normalizeTransactionSecurityResult({
        level: 'medium',
        detail: {
          code: 'untrusted_target_interaction',
          title: 'Approval risk',
          features: [{ code: 'HIGH_RISK_SPENDER', level: 'medium' }],
        },
      });
      const swap = normalizeTransactionSecurityResult({
        level: 'high',
        detail: {
          code: 'known_malicious_interaction',
          title: 'Swap risk',
          features: [
            { code: 'KNOWN_MALICIOUS_ADDRESS', level: 'high' },
            { code: 'HIGH_RISK_SPENDER', level: 'medium' },
          ],
        },
      });
      const merged = mergeTransactionSecurityResults([approval, swap]);
      expect(merged?.level).toBe(EHostSecurityLevel.High);
      expect(merged?.detail.title).toBe('Swap risk');
      expect(merged?.detail.features.map((feature) => feature.code)).toEqual([
        'HIGH_RISK_SPENDER',
        'KNOWN_MALICIOUS_ADDRESS',
      ]);
    });

    it('keeps known risk but does not turn a partial failure green', () => {
      const highRisk = normalizeTransactionSecurityResult({
        level: 'high',
        detail: { code: 'known_malicious_interaction', features: [] },
      });
      const safe = normalizeTransactionSecurityResult({
        level: 'security',
        detail: { code: 'benign', features: [] },
      });
      const unknown = normalizeTransactionSecurityResult({
        level: 'unknown',
        detail: { code: 'unknown', features: [] },
      });
      const failed = createCheckFailedTransactionSecurityResult();
      const unsupported = createNetworkNotSupportedTransactionSecurityResult();
      expect(
        mergeTransactionSecurityResults([undefined, highRisk]),
      ).toMatchObject({
        level: EHostSecurityLevel.High,
        coverage: {
          hasUncoveredRequests: true,
          hasFailedRequests: false,
        },
      });
      expect(mergeTransactionSecurityResults([failed, highRisk])).toMatchObject(
        {
          level: EHostSecurityLevel.High,
          coverage: {
            hasUncoveredRequests: false,
            hasFailedRequests: true,
          },
        },
      );
      expect(mergeTransactionSecurityResults([failed, safe])).toEqual(failed);
      expect(mergeTransactionSecurityResults([failed, unknown])).toEqual(
        failed,
      );
      expect(mergeTransactionSecurityResults([undefined, safe])).toEqual(
        createUnableToAssessTransactionSecurityResult(),
      );
      expect(mergeTransactionSecurityResults([undefined])).toBeUndefined();
      expect(mergeTransactionSecurityResults([failed, failed])).toEqual(failed);
      expect(mergeTransactionSecurityResults([unsupported, unsupported])).toBe(
        unsupported,
      );
      expect(mergeTransactionSecurityResults([unsupported, safe])).toEqual(
        createUnableToAssessTransactionSecurityResult(),
      );
    });

    it('keeps distinct feature evidence and the highest duplicate severity', () => {
      const first = normalizeTransactionSecurityResult({
        level: 'medium',
        detail: {
          code: 'warning',
          features: [
            {
              code: 'SPENDER_RISK',
              address: '0x1',
              title: 'Known spender',
              content: 'Approval for 1 USDC',
              level: 'medium',
            },
          ],
        },
      });
      const second = normalizeTransactionSecurityResult({
        level: 'high',
        detail: {
          code: 'malicious',
          features: [
            {
              code: 'SPENDER_RISK',
              address: '0x1',
              title: 'Known spender',
              content: 'Approval for 1 USDC',
              level: 'high',
            },
            {
              code: 'SPENDER_RISK',
              address: '0x1',
              title: 'Known spender',
              content: 'Approval for 100 USDC',
              level: 'high',
            },
          ],
        },
      });

      expect(
        mergeTransactionSecurityResults([first, second])?.detail.features,
      ).toEqual([
        {
          code: 'SPENDER_RISK',
          address: '0x1',
          title: 'Known spender',
          content: 'Approval for 1 USDC',
          level: EHostSecurityLevel.High,
        },
        {
          code: 'SPENDER_RISK',
          address: '0x1',
          title: 'Known spender',
          content: 'Approval for 100 USDC',
          level: EHostSecurityLevel.High,
        },
      ]);
    });

    it('keeps a secondary risk summary when it has no feature rows', () => {
      const malicious = normalizeTransactionSecurityResult({
        level: 'high',
        detail: {
          code: 'known_malicious_interaction',
          title: 'Malicious interaction',
          features: [],
        },
      });
      const warning = normalizeTransactionSecurityResult({
        level: 'medium',
        detail: {
          code: 'untrusted_target_interaction',
          content: 'Review this transaction before continuing.',
          features: [],
        },
      });

      expect(
        mergeTransactionSecurityResults([malicious, warning])?.detail.features,
      ).toEqual([
        {
          level: EHostSecurityLevel.Medium,
          code: 'untrusted_target_interaction',
          content: 'Review this transaction before continuing.',
        },
      ]);
    });
  });

  describe('buildTransactionSecurityJsonRpc', () => {
    it('forwards the original JSON-RPC request to the server', () => {
      const from = '0x49c73c9d361c04769a452E85D343b41aC38e0EE4';
      const message =
        '{"domain":{"chainId":1},"primaryType":"Permit","message":{}}';
      expect(
        buildTransactionSecurityJsonRpc({
          jsonRpcRequest: {
            method: 'eth_signTypedData_v4',
            params: [from, message],
          },
        }),
      ).toEqual({
        method: 'eth_signTypedData_v4',
        params: [from, message],
      });
    });

    it('skips malformed JSON-RPC requests', () => {
      expect(
        buildTransactionSecurityJsonRpc({
          jsonRpcRequest: {
            method: 'personal_sign',
            params: { message: '0xabc' },
          },
        }),
      ).toBeUndefined();
      expect(
        buildTransactionSecurityJsonRpc({
          jsonRpcRequest: {
            method: 'eth_signTypedData_v4',
          },
        }),
      ).toBeUndefined();
    });
  });
});
