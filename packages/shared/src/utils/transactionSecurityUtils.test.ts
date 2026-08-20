import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';

import {
  buildTransactionSecurityJsonRpc,
  hasTransactionSecurityFeatures,
  mergeTransactionSecurityResults,
  normalizeTransactionSecurityLevel,
  normalizeTransactionSecurityResult,
  shouldShowTransactionSecurityFinding,
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

    it('returns undefined for an empty payload', () => {
      expect(normalizeTransactionSecurityResult({})).toBeUndefined();
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

  describe('display helpers', () => {
    it('shows every result level and shows details only when features exist', () => {
      const benign = normalizeTransactionSecurityResult({
        level: 'security',
        detail: { code: 'no_issues_detected', features: [] },
      });
      const malicious = normalizeTransactionSecurityResult({
        level: 'high',
        detail: {
          code: 'known_malicious_interaction',
          features: [{ code: 'KNOWN_MALICIOUS_ADDRESS', level: 'high' }],
        },
      });
      const warning = normalizeTransactionSecurityResult({
        level: 'medium',
        detail: { code: 'risk_detected', features: [] },
      });
      const unknown = normalizeTransactionSecurityResult({
        level: 'unknown',
        detail: { code: 'unable_to_assess', features: [] },
      });
      expect(
        [benign, warning, malicious, unknown].every((result) =>
          shouldShowTransactionSecurityFinding(result),
        ),
      ).toBe(true);
      expect(hasTransactionSecurityFeatures(benign)).toBe(false);
      expect(hasTransactionSecurityFeatures(malicious)).toBe(true);
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

    it('ignores failed checks', () => {
      const only = normalizeTransactionSecurityResult({
        level: 'high',
        detail: { code: 'known_malicious_interaction', features: [] },
      });
      expect(mergeTransactionSecurityResults([undefined, only])?.level).toBe(
        EHostSecurityLevel.High,
      );
      expect(mergeTransactionSecurityResults([undefined])).toBeUndefined();
    });
  });

  describe('buildTransactionSecurityJsonRpc', () => {
    it.each([
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v1',
      'eth_signTypedData_v3',
      'eth_signTypedData_v4',
    ])('forwards the original %s request to the server', (method) => {
      const from = '0x49c73c9d361c04769a452E85D343b41aC38e0EE4';
      const message =
        '{"domain":{"chainId":1},"primaryType":"Permit","message":{}}';
      expect(
        buildTransactionSecurityJsonRpc({
          jsonRpcRequest: {
            method,
            params: [from, message],
          },
        }),
      ).toEqual({
        method,
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
