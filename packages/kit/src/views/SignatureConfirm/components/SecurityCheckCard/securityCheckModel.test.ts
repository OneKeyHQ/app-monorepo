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
  CHECK_FAILED_FINDING_ID,
  buildSecurityCheckModel,
  getCardSecurityFindings,
  getTargetedScanGapTitle,
  getVisibleSecurityFindings,
  hasSecurityFindingDetails,
  isRedundantSecurityFinding,
  shouldGlowSimulationNest,
  shouldNestSimulationPreview,
  shouldShowAllSecurityFindings,
  shouldShowPrimeCredit,
  shouldShowTargetedScanGap,
  shouldUseCheckFailedStatus,
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
    const model = buildSecurityCheckModel({
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

    expect(model.status).toBe('success');
    expect(model.confirmation).toBe('request');
    expect(model.hasTransactionSecurityCheck).toBe(true);
    expect(model.findings).toEqual([]);
  });

  it('keeps an unlimited approval as request on a safe verdict', () => {
    const model = buildSecurityCheckModel({
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

    expect(model.status).toBe('success');
    expect(model.confirmation).toBe('request');
    expect(model.findings).toEqual([]);
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
      'The spender can move your full USDC balance.',
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

  it('includes address risk in the overall verdict without duplicating it', () => {
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
      intl,
    });

    expect(model.status).toBe('warning');
    expect(model.confirmation).toBe('risk');
    expect(model.findings).toEqual([]);
    expect(model.statusSourceTitle).toBe(
      ETranslations.dapp_connect_signature_analysis__title,
    );
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
    expect(model.shouldShowNoIssue).toBe(false);
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
    expect(model.defaultExpanded).toBe(false);
    expect(model.findings[0]?.title).toBe(
      ETranslations.kyt_risk_check_failed__title,
    );
    expect(model.findings[0]?.description).toBeUndefined();
    expect(model.findings[0]?.id).toBe('tx-security-check-failed');
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

    expect(
      model.groupedFindings.operation.map((finding) => finding.status),
    ).toEqual(['warning', 'unknown']);
    expect(
      model.groupedFindings.operation.map((finding) => finding.id),
    ).toEqual([
      'parser-alert-0-Review this request',
      'tx-security-unable_to_assess',
    ]);
  });

  it('does not attribute basic checks to transaction security', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      intl,
    });

    expect(model.status).toBe('success');
    expect(model.hasTransactionSecurityCheck).toBe(false);
    expect(model.showTargetedScanGap).toBe(true);
  });

  it('does not show a targeted-scan gap after a real request scan', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(model.status).toBe('success');
    expect(model.showTargetedScanGap).toBe(false);
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

describe('security check display helpers', () => {
  it('shows Prime credit only on safe results without a targeted scan', () => {
    expect(
      shouldShowPrimeCredit({ status: 'success', isPrimeUser: false }),
    ).toBe(true);
    expect(shouldShowPrimeCredit({ status: 'info', isPrimeUser: false })).toBe(
      true,
    );
    expect(
      shouldShowPrimeCredit({
        status: 'success',
        isPrimeUser: false,
        hasTransactionSecurityCheck: true,
      }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'critical', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'warning', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'loading', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'check_failed', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'unknown', isPrimeUser: false }),
    ).toBe(false);
    expect(
      shouldShowPrimeCredit({ status: 'success', isPrimeUser: true }),
    ).toBe(false);
    expect(shouldShowPrimeCredit({ status: 'success' })).toBe(false);
  });

  it('shows a targeted-scan gap only on success without a request scan', () => {
    expect(
      shouldShowTargetedScanGap({
        status: 'success',
        hasTransactionSecurityCheck: false,
      }),
    ).toBe(true);
    expect(
      shouldShowTargetedScanGap({
        status: 'success',
        hasTransactionSecurityCheck: true,
      }),
    ).toBe(false);
    expect(
      shouldShowTargetedScanGap({
        status: 'warning',
        hasTransactionSecurityCheck: false,
      }),
    ).toBe(false);
    expect(getTargetedScanGapTitle(intl)).toBe(
      `${ETranslations.prime_feature_transaction_security_check__title} · ${ETranslations.global_not_available}`,
    );
  });

  it('keeps the simulation preview flat on the card plane', () => {
    expect(
      shouldNestSimulationPreview({ hasAssets: true, status: 'success' }),
    ).toBe(false);
    expect(
      shouldNestSimulationPreview({ hasAssets: true, status: 'warning' }),
    ).toBe(false);
    expect(
      shouldNestSimulationPreview({ hasAssets: true, status: 'unknown' }),
    ).toBe(false);
    expect(shouldGlowSimulationNest('warning')).toBe(false);
    expect(shouldGlowSimulationNest('critical')).toBe(false);
  });

  it('features the worst decision finding and keeps unknown off the card', () => {
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
    ]);
    expect(card.shownCount).toBe(3);
    expect(card.decisionCount).toBe(4);
    expect(
      shouldShowAllSecurityFindings({
        findings: [
          siteWarning,
          spenderWarning,
          allowanceWarning,
          extraWarning,
          unknown,
        ],
        shownCount: card.shownCount,
        statusLabel: 'Warning',
      }),
    ).toBe(true);
    expect(
      shouldShowAllSecurityFindings({
        findings: [unknown],
        shownCount: 0,
        statusLabel: 'Unverified',
      }),
    ).toBe(false);
  });

  it('hides a check-failed row that only restates the badge', () => {
    const checkFailed = {
      id: CHECK_FAILED_FINDING_ID,
      category: 'operation' as const,
      status: 'unknown' as const,
      title: 'Check failed',
    };
    expect(shouldUseCheckFailedStatus([checkFailed])).toBe(true);
    expect(
      getVisibleSecurityFindings([checkFailed], 'Check failed').map(
        (finding) => finding.id,
      ),
    ).toEqual([]);
  });

  it('hides findings that only repeat the badge', () => {
    const parrot = {
      id: 'site-unknown',
      category: 'site' as const,
      status: 'unknown' as const,
      title: 'Unverified',
    };
    const fact = {
      id: 'check-failed',
      category: 'operation' as const,
      status: 'unknown' as const,
      title: 'Check failed',
    };
    expect(
      isRedundantSecurityFinding({
        finding: parrot,
        statusLabel: 'Unverified',
      }),
    ).toBe(true);
    expect(
      getVisibleSecurityFindings([parrot, fact], 'Unverified').map(
        (finding) => finding.id,
      ),
    ).toEqual(['check-failed']);
  });

  it('opens details only when a finding has description or an action', () => {
    const titleOnly = {
      id: 'parser',
      category: 'operation' as const,
      status: 'warning' as const,
      title: 'The spender is an EOA',
    };
    const withDescription = {
      ...titleOnly,
      description: 'This approval stays valid until you revoke it.',
    };
    const withAction = {
      ...titleOnly,
      action: {
        type: 'site' as const,
        origin: 'https://app.uniswap.org',
        urlSecurityInfo: { level: EHostSecurityLevel.High } as IHostSecurity,
      },
    };

    expect(hasSecurityFindingDetails(titleOnly)).toBe(false);
    expect(hasSecurityFindingDetails(titleOnly, '   ')).toBe(false);
    expect(
      hasSecurityFindingDetails(withDescription, withDescription.description),
    ).toBe(true);
    expect(hasSecurityFindingDetails(withAction)).toBe(true);
  });
});
