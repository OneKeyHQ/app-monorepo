import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';
import {
  ETransactionSecurityResultCode,
  type ITransactionSecurityCheckResult,
} from '@onekeyhq/shared/types/transactionSecurity';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import {
  buildSecurityCheckModel,
  canRetryTransactionSecurityCheck,
  getCardSecurityFindings,
  getSecurityCheckCoverage,
  shouldShowPrimeInvite,
  sortSecurityFindings,
} from './securityCheckModel';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id?: string }) => id ?? '',
} as Pick<IntlShape, 'formatMessage'>;

const verifiedSite = {
  level: EHostSecurityLevel.Security,
} as IHostSecurity;

const parsedMessage: ISignatureConfirmDisplay = {
  title: 'Signature request',
  components: [],
  alerts: [],
};

const permitMessage: IUnsignedMessage = {
  type: EMessageTypesEth.TYPED_DATA_V4,
  message: JSON.stringify({ primaryType: 'Permit' }),
};

function buildTransactionSecurityResult(
  level: EHostSecurityLevel,
): ITransactionSecurityCheckResult {
  return {
    level,
    detail: {
      code: `result-${level}`,
      title: `Result ${level}`,
      features: [],
    },
  };
}

describe('securityCheckModel', () => {
  it('keeps request confirmation separate from a safe verdict', () => {
    const messageModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isConfirmationRequired: true,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });
    const transactionModel = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        {
          isConfirmationRequired: true,
          isLocalParsed: false,
          txDisplay: { title: 'Approval', components: [], alerts: [] },
        } as unknown as IDecodedTx,
      ],
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(messageModel).toMatchObject({
      status: 'success',
      confirmation: 'request',
      hasTransactionSecurityCheck: true,
      findings: [],
    });
    expect(transactionModel).toMatchObject({
      status: 'success',
      confirmation: 'request',
      findings: [],
    });
  });

  it('uses a Prime risk result for both the card and confirmation gate', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.High,
      ),
      intl,
    });

    expect(model.status).toBe('critical');
    expect(model.confirmation).toBe('risk');
    expect(model.findings.map((finding) => finding.id)).toEqual([
      'tx-security-result-high',
    ]);
  });

  it('keeps Prime features off the card and behind the finding action', () => {
    const transactionSecurityInfo: ITransactionSecurityCheckResult = {
      level: EHostSecurityLevel.High,
      detail: {
        code: 'approval_drain',
        title: 'The spender can move your full USDC balance.',
        content: 'This approval stays valid until you revoke it.',
        features: [
          {
            level: EHostSecurityLevel.High,
            code: 'unlimited_approval',
            title: 'Unlimited USDC allowance',
            content: 'The spender can transfer the full balance.',
            address: '0x000000000022d473030f116ddee9f6b43ac78ba3',
          },
          {
            level: EHostSecurityLevel.Medium,
            code: 'new_spender',
            title: 'Spender not seen before',
          },
        ],
      },
    };
    const model = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        {
          isLocalParsed: false,
          txDisplay: { title: 'Approval', components: [], alerts: [] },
        } as unknown as IDecodedTx,
      ],
      transactionSecurityInfo,
      intl,
    });
    const card = getCardSecurityFindings(model.findings);

    expect(model.findings).toHaveLength(1);
    expect(model.findings[0]?.title).toBe(
      'The spender can move your full USDC balance',
    );
    expect(model.findings[0]?.description).toBe(
      'This approval stays valid until you revoke it.',
    );
    expect(model.findings[0]?.action).toEqual({
      type: 'transactionSecurity',
      result: transactionSecurityInfo,
    });
    expect(card.featured?.id).toBe(model.findings[0]?.id);
    expect(card.listed).toEqual([]);
  });

  it('keeps a trusted generic Permit request informational', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        alerts: [ETranslations.dapp_connect_permit_sign_alert],
      },
      unsignedMessage: permitMessage,
      isConfirmationRequired: true,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(model.status).toBe('success');
    expect(model.confirmation).toBe('none');
    expect(model.findings).toEqual([
      expect.objectContaining({ id: 'message-permit', status: 'info' }),
    ]);
  });

  it('uses address risk as a fallback when the targeted scan has no conclusion', () => {
    const withoutScan = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [
          {
            type: EParseTxComponentType.Address,
            label: 'Spender',
            address: '0xrisk',
            tags: [{ value: 'Suspicious address', displayType: 'warning' }],
          },
        ],
      },
      intl,
    });
    const unknownScan = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [
          {
            type: EParseTxComponentType.Address,
            label: 'Spender',
            address: '0xrisk',
            tags: [{ value: 'Malicious address', displayType: 'critical' }],
          },
        ],
      },
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Unknown,
      ),
      intl,
    });

    expect(withoutScan).toMatchObject({
      status: 'warning',
      confirmation: 'risk',
      findings: [],
    });
    expect(unknownScan).toMatchObject({
      status: 'critical',
      confirmation: 'risk',
    });
  });

  it('prefers a conclusive targeted scan over address tags', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [
          {
            type: EParseTxComponentType.Address,
            label: 'Spender',
            address: '0xrisk',
            tags: [{ value: 'Suspicious address', displayType: 'warning' }],
          },
        ],
      },
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(model.status).toBe('success');
    expect(model.confirmation).toBe('none');
  });

  it('keeps the legacy message risk gate for an untrusted Permit or tagged trusted Permit', () => {
    const untrustedPermit = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: { level: EHostSecurityLevel.Unknown } as IHostSecurity,
      messageDisplay: parsedMessage,
      unsignedMessage: permitMessage,
      isRiskSignMethod: true,
      intl,
    });
    const trustedPermitWithAddressRisk = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [
          {
            type: EParseTxComponentType.Address,
            label: 'Spender',
            address: '0xrisk',
            tags: [{ value: 'Suspicious address', displayType: 'warning' }],
          },
        ],
      },
      unsignedMessage: permitMessage,
      intl,
    });

    expect(untrustedPermit.confirmation).toBe('risk');
    expect(trustedPermitWithAddressRisk.confirmation).toBe('risk');
    expect(trustedPermitWithAddressRisk.status).toBe('warning');
  });

  it('keeps an existing warning visible while Prime is still checking', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        alerts: ['Review this request'],
      },
      isTransactionSecurityPending: true,
      intl,
    });

    expect(model.status).toBe('warning');
    expect(model.confirmation).toBe('pending');
    expect(model.isPending).toBe(true);
    expect(model.findings).toHaveLength(1);
    expect(model.findings[0].id).toContain('parser-alert');
  });

  it('keeps a visible loading state before the first finding arrives', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isTransactionSecurityPending: true,
      intl,
    });

    expect(model.status).toBe('loading');
    expect(model.confirmation).toBe('pending');
    expect(model.isPending).toBe(true);
    expect(model.hasTransactionSecurityCheck).toBe(true);
    expect(model.findings).toEqual([]);
  });

  it('blocks confirmation while the site or parser check is pending', () => {
    const sitePending = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      messageDisplay: parsedMessage,
      intl,
    });
    const malformedSitePending = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: {} as IHostSecurity,
      messageDisplay: parsedMessage,
      intl,
    });
    const parserPending = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      isParserPending: true,
      intl,
    });

    expect(sitePending).toMatchObject({
      status: 'loading',
      confirmation: 'pending',
      isPending: true,
    });
    expect(malformedSitePending).toMatchObject({
      status: 'loading',
      confirmation: 'pending',
      isPending: true,
    });
    expect(parserPending).toMatchObject({
      status: 'loading',
      confirmation: 'pending',
      isPending: true,
    });
    expect(
      parserPending.coverage.find((item) => item.source === 'parser')?.state,
    ).toBe('pending');
  });

  it('requires review when message or transaction parsing falls back', () => {
    const messageFallback = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isMessageParseFallback: true,
      intl,
    });
    const transactionFallback = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        {
          isLocalParsed: true,
          txDisplay: { title: 'Transaction', components: [], alerts: [] },
        } as unknown as IDecodedTx,
      ],
      intl,
    });

    expect(messageFallback).toMatchObject({
      status: 'unknown',
      confirmation: 'request',
    });
    expect(transactionFallback).toMatchObject({
      status: 'unknown',
      confirmation: 'request',
    });
    expect(getCardSecurityFindings(messageFallback.findings).featured?.id).toBe(
      'message-parse-fallback',
    );
  });

  it('does not treat a failed request scan as SignGuard coverage', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: {
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.CheckFailed,
          features: [],
        },
      },
      intl,
    });

    expect(model.status).toBe('check_failed');
    expect(model.confirmation).toBe('none');
    expect(model.hasTransactionSecurityCheck).toBe(false);
    expect(model.findings[0]?.title).toBe(
      ETranslations.kyt_risk_check_failed__title,
    );
    expect(model.findings[0]?.description).toBeUndefined();
    expect(model.findings[0]?.id).toBe('tx-security-check-failed');
    expect(canRetryTransactionSecurityCheck(model.findings)).toBe(true);
  });

  it('keeps retry available when a failed scan sits next to another finding', () => {
    const checkFailed = {
      level: EHostSecurityLevel.Unknown,
      detail: {
        code: ETransactionSecurityResultCode.CheckFailed,
        features: [],
      },
    };
    const unverified = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: { level: EHostSecurityLevel.Unknown } as IHostSecurity,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: checkFailed,
      intl,
    });
    const warning = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: { level: EHostSecurityLevel.Medium } as IHostSecurity,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: checkFailed,
      intl,
    });

    expect(unverified.status).toBe('unknown');
    expect(warning.status).toBe('warning');
    expect(canRetryTransactionSecurityCheck(unverified.findings)).toBe(true);
    expect(canRetryTransactionSecurityCheck(warning.findings)).toBe(true);
  });

  it('returns to loading when a failed scan is retried', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: {
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.CheckFailed,
          features: [],
        },
      },
      isTransactionSecurityPending: true,
      intl,
    });

    expect(model.status).toBe('loading');
    expect(model.confirmation).toBe('pending');
    expect(model.hasTransactionSecurityCheck).toBe(true);
  });

  it('does not force confirmation when the scan cannot assess the request', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Unknown,
      ),
      intl,
    });

    expect(model.status).toBe('unknown');
    expect(model.confirmation).toBe('none');
    expect(model.hasTransactionSecurityCheck).toBe(true);
  });

  it('sorts findings by severity instead of Prime source', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        alerts: ['Review this request'],
      },
      transactionSecurityInfo: {
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.UnableToAssess,
          features: [],
        },
      },
      intl,
    });

    const operationFindings = sortSecurityFindings(
      model.findings.filter((finding) => finding.category === 'operation'),
    );
    expect(operationFindings.map((finding) => finding.status)).toEqual([
      'warning',
      'unknown',
    ]);
    expect(operationFindings.map((finding) => finding.id)).toEqual([
      'parser-alert-0-Review this request',
      'tx-security-unable_to_assess',
    ]);
  });

  it('attributes transaction-security coverage only after a completed request scan', () => {
    const localModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      intl,
    });
    const scannedModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(localModel).toMatchObject({
      status: 'success',
      hasTransactionSecurityCheck: false,
    });
    expect(scannedModel).toMatchObject({
      status: 'success',
      hasTransactionSecurityCheck: true,
    });
  });

  it('drops a Prime warning description that only restates the badge', () => {
    const model = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [],
      transactionSecurityInfo: {
        level: EHostSecurityLevel.Medium,
        detail: {
          code: 'medium',
          features: [],
        },
      },
      intl,
    });

    expect(model.findings[0]?.title).toBe(
      ETranslations.dapp_connect_security_checks_risk_review_required__title,
    );
    expect(model.findings[0]?.description).toBeUndefined();
    expect(model.findings[0]?.action).toBeUndefined();
  });
});

describe('security check coverage', () => {
  const parsedTx = {
    isLocalParsed: false,
    txDisplay: { title: 'Approval', components: [], alerts: [] },
  } as unknown as IDecodedTx;

  it('lists site, parser, and locked Prime coverage for a free user', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [parsedTx],
      isPrimeUser: false,
    });

    expect(coverage).toEqual([
      { source: 'site', state: 'completed' },
      { source: 'parser', state: 'completed' },
      { source: 'requestScan', state: 'locked' },
    ]);
  });

  it('marks Prime coverage completed after a targeted scan', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      isPrimeUser: true,
    });

    expect(coverage).toEqual([
      { source: 'site', state: 'completed' },
      { source: 'parser', state: 'completed' },
      { source: 'requestScan', state: 'completed' },
    ]);
  });

  it('marks Prime coverage notApplicable when a Prime user has no scan', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [parsedTx],
      isPrimeUser: true,
    });

    expect(coverage.find((item) => item.source === 'requestScan')?.state).toBe(
      'notApplicable',
    );
  });

  it('keeps Prime coverage pending while checking', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isTransactionSecurityPending: true,
      isPrimeUser: true,
    });

    expect(coverage.find((item) => item.source === 'requestScan')?.state).toBe(
      'pending',
    );
  });

  it('marks parser unknown on local parse fallback', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [{ ...parsedTx, isLocalParsed: true }],
      isPrimeUser: false,
    });

    expect(coverage.find((item) => item.source === 'parser')?.state).toBe(
      'unknown',
    );
  });

  it('marks site and parser notApplicable when those checks cannot run', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'transaction',
      isPrimeUser: false,
    });

    expect(coverage).toEqual([
      { source: 'site', state: 'notApplicable' },
      { source: 'parser', state: 'notApplicable' },
      { source: 'requestScan', state: 'locked' },
    ]);
  });

  it('does not label an unverified site as checked', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: { level: EHostSecurityLevel.Unknown } as IHostSecurity,
      messageDisplay: parsedMessage,
      isPrimeUser: false,
    });

    expect(coverage.find((item) => item.source === 'site')?.state).toBe(
      'unknown',
    );
  });

  it('does not flash a Prime unlock before persist membership is known', () => {
    const coverage = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
    });

    expect(coverage.find((item) => item.source === 'requestScan')?.state).toBe(
      'notApplicable',
    );
  });

  it('marks Prime coverage failed or unknown from the scan result', () => {
    const failed = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: {
        level: EHostSecurityLevel.Unknown,
        detail: {
          code: ETransactionSecurityResultCode.CheckFailed,
          features: [],
        },
      },
      isPrimeUser: true,
    });
    const unverified = getSecurityCheckCoverage({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Unknown,
      ),
      isPrimeUser: true,
    });

    expect(failed.find((item) => item.source === 'requestScan')?.state).toBe(
      'failed',
    );
    expect(
      unverified.find((item) => item.source === 'requestScan')?.state,
    ).toBe('unknown');
  });
});

describe('security check display helpers', () => {
  it('shows the Prime invite only on safe results without a targeted scan', () => {
    expect(
      shouldShowPrimeInvite({ status: 'success', isPrimeUser: false }),
    ).toBe(true);
    expect(shouldShowPrimeInvite({ status: 'info', isPrimeUser: false })).toBe(
      true,
    );
    expect(
      shouldShowPrimeInvite({
        status: 'success',
        isPrimeUser: false,
        hasTransactionSecurityCheck: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPrimeInvite({ status: 'critical', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeInvite({ status: 'warning', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeInvite({ status: 'loading', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeInvite({ status: 'success', isPrimeUser: true }),
    ).toBe(false);
    expect(shouldShowPrimeInvite({ status: 'success' })).toBe(false);
  });

  it('does not call a site-only batch result a successful transaction check', () => {
    const model = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      isPrimeUser: false,
      intl,
    });

    expect(model).toMatchObject({
      status: undefined,
      confirmation: 'none',
      findings: [],
    });
    expect(model.coverage).toEqual([
      { source: 'site', state: 'completed' },
      { source: 'parser', state: 'notApplicable' },
      { source: 'requestScan', state: 'locked' },
    ]);
    expect(
      shouldShowPrimeInvite({
        status: model.status,
        isPrimeUser: model.isPrimeUser,
        hasTransactionSecurityCheck: model.hasTransactionSecurityCheck,
      }),
    ).toBe(false);
  });

  it('features the worst decision finding and keeps non-decision context visible', () => {
    const siteWarning = {
      id: 'site-medium',
      category: 'site' as const,
      status: 'warning' as const,
      title: 'Unusual first-visit traffic',
    };
    const spenderWarning = {
      id: 'spender',
      category: 'operation' as const,
      status: 'warning' as const,
      title: 'Spender not seen before',
    };
    const allowanceWarning = {
      id: 'allowance',
      category: 'operation' as const,
      status: 'warning' as const,
      title: 'Unlimited USDC allowance',
    };
    const extraWarning = {
      id: 'extra',
      category: 'operation' as const,
      status: 'warning' as const,
      title: 'Extra warning',
    };
    const unknown = {
      id: 'unverified',
      category: 'operation' as const,
      status: 'unknown' as const,
      title: 'Contract could not be verified',
    };
    const card = getCardSecurityFindings([
      unknown,
      extraWarning,
      allowanceWarning,
      spenderWarning,
      siteWarning,
    ]);

    expect(card.featured?.id).toBe('site-medium');
    expect(card.listed.map((finding) => finding.id)).toEqual([
      'extra',
      'allowance',
      'unverified',
    ]);
    expect(card.allDecisionFindings.map((finding) => finding.id)).toEqual([
      'site-medium',
      'extra',
      'allowance',
      'spender',
    ]);
    expect(card.hasHiddenDecisionFindings).toBe(true);
  });
});
