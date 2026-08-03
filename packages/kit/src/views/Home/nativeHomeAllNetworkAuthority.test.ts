import {
  createNativeHomeAllNetworkRequestOutcome,
  filterNativeHomeAllNetworkAuthoritativeResponses,
  recordNativeHomeAllNetworkFailure,
  recordNativeHomeAllNetworkResponse,
  resolveNativeHomeAllNetworkAuthorityStatus,
} from './nativeHomeAllNetworkAuthority';

describe.each(['Portfolio', 'DeFi'])(
  '%s AllNetworks response authority',
  () => {
    it('rejects and excludes a response for a stale AllNetworks owner', () => {
      const staleResponse = {
        id: 'stale',
        isSameAllNetworksAccountData: false,
      };
      const outcome = recordNativeHomeAllNetworkResponse(
        createNativeHomeAllNetworkRequestOutcome(),
        staleResponse,
      );

      expect(outcome).toEqual({
        attemptCount: 1,
        failureCount: 1,
        successCount: 0,
      });
      expect(
        resolveNativeHomeAllNetworkAuthorityStatus({
          emptyAccountsResolved: false,
          expectedRequestCount: 1,
          outcome,
          startedSucceeded: true,
        }),
      ).toBe('error');
      expect(
        filterNativeHomeAllNetworkAuthoritativeResponses([staleResponse]),
      ).toEqual([]);
    });

    it('keeps only current-owner data and rejects partial stale results', () => {
      const currentResponse = {
        id: 'current',
        isSameAllNetworksAccountData: true,
      };
      const staleResponse = {
        id: 'stale',
        isSameAllNetworksAccountData: false,
      };
      const outcome = [currentResponse, staleResponse].reduce(
        recordNativeHomeAllNetworkResponse,
        createNativeHomeAllNetworkRequestOutcome(),
      );

      expect(outcome).toEqual({
        attemptCount: 2,
        failureCount: 1,
        successCount: 1,
      });
      expect(
        resolveNativeHomeAllNetworkAuthorityStatus({
          emptyAccountsResolved: false,
          expectedRequestCount: 2,
          outcome,
          startedSucceeded: true,
        }),
      ).toBe('error');
      expect(
        filterNativeHomeAllNetworkAuthoritativeResponses([
          currentResponse,
          staleResponse,
        ]),
      ).toEqual([currentResponse]);
    });

    it('rejects a partial run when one current-owner request rejects', () => {
      const currentResponse = {
        isSameAllNetworksAccountData: true,
      };
      const partialOutcome = recordNativeHomeAllNetworkFailure(
        recordNativeHomeAllNetworkResponse(
          createNativeHomeAllNetworkRequestOutcome(),
          currentResponse,
        ),
      );

      expect(partialOutcome).toEqual({
        attemptCount: 2,
        failureCount: 1,
        successCount: 1,
      });
      expect(
        resolveNativeHomeAllNetworkAuthorityStatus({
          emptyAccountsResolved: false,
          expectedRequestCount: 2,
          outcome: partialOutcome,
          startedSucceeded: true,
        }),
      ).toBe('error');
    });

    it('rejects empty accounts when onStarted fails', () => {
      expect(
        resolveNativeHomeAllNetworkAuthorityStatus({
          emptyAccountsResolved: true,
          expectedRequestCount: 0,
          outcome: createNativeHomeAllNetworkRequestOutcome(),
          startedSucceeded: false,
        }),
      ).toBe('error');
    });

    it('accepts empty accounts only after onStarted succeeds', () => {
      expect(
        resolveNativeHomeAllNetworkAuthorityStatus({
          emptyAccountsResolved: true,
          expectedRequestCount: 0,
          outcome: createNativeHomeAllNetworkRequestOutcome(),
          startedSucceeded: true,
        }),
      ).toBe('success');
    });
  },
);
