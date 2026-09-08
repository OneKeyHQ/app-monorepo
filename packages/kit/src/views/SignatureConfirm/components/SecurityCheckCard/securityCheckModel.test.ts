import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
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

function buildTypedDataMessage(primaryType: string): IUnsignedMessage {
  return {
    type: EMessageTypesEth.TYPED_DATA_V4,
    message: stableStringify({ primaryType }),
  };
}

const permitMessage = buildTypedDataMessage('Permit');

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

function buildDecodedTx(overrides: Partial<IDecodedTx> = {}): IDecodedTx {
  return {
    isLocalParsed: false,
    isConfirmationRequired: false,
    txDisplay: { title: 'Send', components: [], alerts: [] },
    ...overrides,
  } as unknown as IDecodedTx;
}

function buildAddressComponent({
  displayType,
  address = '0xrisk',
  value = 'Risky address',
}: {
  displayType: 'warning' | 'critical';
  address?: string;
  value?: string;
}) {
  return {
    type: EParseTxComponentType.Address as const,
    label: 'To',
    address,
    tags: [{ value, displayType }],
  };
}

describe('securityCheckModel', () => {
  it.each([
    [
      'message',
      () =>
        buildSecurityCheckModel({
          kind: 'message',
          origin: 'https://app.example.com',
          urlSecurityInfo: verifiedSite,
          messageDisplay: parsedMessage,
          isConfirmationRequired: true,
          transactionSecurityInfo: buildTransactionSecurityResult(
            EHostSecurityLevel.Security,
          ),
          intl,
        }),
      'message-confirmation-required',
    ],
    [
      'transaction',
      () =>
        buildSecurityCheckModel({
          kind: 'transaction',
          origin: 'https://app.example.com',
          urlSecurityInfo: verifiedSite,
          decodedTxs: [buildDecodedTx({ isConfirmationRequired: true })],
          transactionSecurityInfo: buildTransactionSecurityResult(
            EHostSecurityLevel.Security,
          ),
          intl,
        }),
      'tx-confirmation-required',
    ],
  ] as const)(
    'treats an explicit %s confirmation flag as risk even when Prime is Safe',
    (_kind, buildModel, findingId) => {
      const model = buildModel();
      expect(model.confirmation).toBe('risk');
      expect(model.status).toBe('warning');
      expect(model.findings).toContainEqual(
        expect.objectContaining({ id: findingId, status: 'warning' }),
      );
    },
  );

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

  it('changes acknowledgement identity with the request or decision', () => {
    const buildModel = (requestKey: string, level: EHostSecurityLevel) =>
      buildSecurityCheckModel({
        kind: 'message',
        requestKey,
        origin: 'https://app.example.com',
        urlSecurityInfo: { ...verifiedSite, level },
        messageDisplay: parsedMessage,
        intl,
      });
    const warning = buildModel('request-1', EHostSecurityLevel.Medium);

    expect(
      buildModel('request-2', EHostSecurityLevel.Medium).acknowledgementKey,
    ).not.toBe(warning.acknowledgementKey);
    expect(
      buildModel('request-1', EHostSecurityLevel.High).acknowledgementKey,
    ).not.toBe(warning.acknowledgementKey);
  });

  it('invalidates acknowledgement when a trusted Permit address risk changes', () => {
    const buildModel = ({
      displayType,
      address = '0xrisk',
    }: {
      displayType: 'warning' | 'critical';
      address?: string;
    }) =>
      buildSecurityCheckModel({
        kind: 'message',
        requestKey: 'same-request',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        messageDisplay: {
          ...parsedMessage,
          components: [buildAddressComponent({ displayType, address })],
        },
        unsignedMessage: permitMessage,
        transactionSecurityInfo: buildTransactionSecurityResult(
          EHostSecurityLevel.Security,
        ),
        intl,
      });

    const warning = buildModel({ displayType: 'warning' });
    const critical = buildModel({ displayType: 'critical' });
    const otherTarget = buildModel({
      displayType: 'warning',
      address: '0xother',
    });
    expect(warning).toMatchObject({
      confirmation: 'risk',
      status: undefined,
      findings: [],
    });
    expect(critical.acknowledgementKey).not.toBe(warning.acknowledgementKey);
    expect(otherTarget.acknowledgementKey).not.toBe(warning.acknowledgementKey);
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
    expect(card.visibleFindings).toEqual(model.findings);
  });

  it('does not synthesize generic typed-data findings for a trusted site', () => {
    const models = ['Permit', 'Order', 'Login'].map((primaryType) =>
      buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        messageDisplay:
          primaryType === 'Permit'
            ? {
                ...parsedMessage,
                alerts: [ETranslations.dapp_connect_permit_sign_alert],
              }
            : parsedMessage,
        unsignedMessage: buildTypedDataMessage(primaryType),
        isConfirmationRequired: primaryType === 'Permit',
        transactionSecurityInfo: buildTransactionSecurityResult(
          EHostSecurityLevel.Security,
        ),
        intl,
      }),
    );

    models.forEach((model) => {
      expect(model.status).toBe('success');
      expect(model.findings).toEqual([]);
    });
    expect(models[0]?.confirmation).toBe('none');
  });

  it.each(['warning', 'critical'] as const)(
    'keeps ordinary %s address tags off the card and out of the confirmation gate',
    (displayType) => {
      const internalSend = buildSecurityCheckModel({
        kind: 'transaction',
        decodedTxs: [
          buildDecodedTx({
            txDisplay: {
              title: 'Send',
              components: [
                buildAddressComponent({
                  displayType,
                  value: 'Initial transfer',
                }),
              ],
              alerts: [],
            },
          }),
        ],
        intl,
      });
      const message = buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        messageDisplay: {
          ...parsedMessage,
          components: [buildAddressComponent({ displayType })],
        },
        intl,
      });
      const transaction = buildSecurityCheckModel({
        kind: 'transaction',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        decodedTxs: [
          buildDecodedTx({
            txDisplay: {
              title: 'Send',
              components: [buildAddressComponent({ displayType })],
              alerts: [],
            },
          }),
        ],
        intl,
      });

      for (const model of [internalSend, message, transaction]) {
        expect(model).toMatchObject({
          status: undefined,
          confirmation: 'none',
          findings: [],
        });
      }
    },
  );

  it('does not let a Safe Prime scan restore success over address tags', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [buildAddressComponent({ displayType: 'warning' })],
      },
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Security,
      ),
      intl,
    });

    expect(model.status).toBeUndefined();
    expect(model.confirmation).toBe('none');

    const partialModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [buildAddressComponent({ displayType: 'critical' })],
      },
      transactionSecurityInfo: {
        ...buildTransactionSecurityResult(EHostSecurityLevel.Medium),
        coverage: {
          hasUncoveredRequests: true,
          hasFailedRequests: false,
        },
      },
      intl,
    });

    expect(partialModel.status).toBe('warning');
    expect(partialModel.confirmation).toBe('risk');
    expect(
      partialModel.coverage.find((item) => item.source === 'requestScan')
        ?.state,
    ).toBe('unknown');
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
    expect(untrustedPermit.findings).toContainEqual(
      expect.objectContaining({ id: 'message-permit', status: 'warning' }),
    );
    expect(trustedPermitWithAddressRisk).toMatchObject({
      confirmation: 'risk',
      status: undefined,
      findings: [],
    });
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
    expect(model.findings).toEqual([]);
  });

  it('blocks confirmation while the site or parser check is pending', () => {
    const sitePending = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
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
    const serverAnalyzedLocalTransaction = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        {
          isLocalParsed: true,
          hasServerSecurityAnalysis: true,
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
    expect(
      getCardSecurityFindings(messageFallback.findings).visibleFindings[0]?.id,
    ).toBe('message-parse-fallback');
    expect(serverAnalyzedLocalTransaction).toMatchObject({
      status: 'success',
      confirmation: 'none',
    });
    expect(
      serverAnalyzedLocalTransaction.coverage.find(
        (item) => item.source === 'parser',
      )?.state,
    ).toBe('completed');
    expect(
      serverAnalyzedLocalTransaction.findings.some(
        (finding) => finding.id === 'tx-parse-fallback',
      ),
    ).toBe(false);
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
    expect(model.findings[0]?.title).toBe(
      ETranslations.transaction_security_check_incomplete__title,
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

  it('keeps a failed sibling visible next to a conclusive risk result', () => {
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      transactionSecurityInfo: {
        ...buildTransactionSecurityResult(EHostSecurityLevel.High),
        coverage: {
          hasUncoveredRequests: false,
          hasFailedRequests: true,
        },
      },
      intl,
    });

    expect(model.status).toBe('critical');
    expect(model.confirmation).toBe('risk');
    expect(
      model.coverage.find((item) => item.source === 'requestScan')?.state,
    ).toBe('failed');
    expect(canRetryTransactionSecurityCheck(model.findings)).toBe(true);
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
    expect(operationFindings[1]?.title).toBe(
      ETranslations.transaction_security_unable_to_assess__title,
    );
  });

  it.each([
    [ETransactionSecurityResultCode.CheckUnavailable, 'unavailable'],
    [ETransactionSecurityResultCode.NetworkNotSupported, 'networkUnsupported'],
  ] as const)(
    'keeps %s in coverage without degrading completed base checks',
    (code, coverageState) => {
      const model = buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        messageDisplay: parsedMessage,
        transactionSecurityInfo: {
          level: EHostSecurityLevel.Unknown,
          detail: { code, features: [] },
        },
        isPrimeUser: true,
        intl,
      });

      expect(model.status).toBe('success');
      expect(model.confirmation).toBe('none');
      expect(
        model.coverage.find((item) => item.source === 'requestScan')?.state,
      ).toBe(coverageState);
      expect(model.findings).toEqual([]);
      expect(canRetryTransactionSecurityCheck(model.findings)).toBe(false);
    },
  );

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

  it.each([
    [
      'parser alerts',
      {
        txDisplay: {
          title: 'Send',
          components: [],
          alerts: ['The spender is an EOA'],
        },
      },
    ],
    ['custom hex', { isCustomHexData: true }],
  ])('does not gate a transaction for %s', (_title, overrides) => {
    const model = buildSecurityCheckModel({
      kind: 'transaction',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [buildDecodedTx(overrides)],
      intl,
    });
    expect(model.confirmation).toBe('none');
    expect(model.status).toBe('warning');
    expect(model.findings.length).toBeGreaterThan(0);
  });

  it.each([
    [EHostSecurityLevel.Unknown, 'risk'],
    [EHostSecurityLevel.Security, 'none'],
  ] as const)(
    'gates ordinary message parser alerts for site %s',
    (level, confirmation) => {
      const model = buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: { ...verifiedSite, level } as IHostSecurity,
        messageDisplay: {
          ...parsedMessage,
          alerts: ['Review this request'],
        },
        intl,
      });
      expect(model.confirmation).toBe(confirmation);
      expect(
        model.findings.some((finding) => finding.id.includes('parser-alert')),
      ).toBe(true);
    },
  );

  it('keeps a trusted Permit generic alert exempt and a specific alert as risk', () => {
    const genericAlert = ETranslations.dapp_connect_permit_sign_alert;
    const generic = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: { ...parsedMessage, alerts: [genericAlert] },
      unsignedMessage: permitMessage,
      isConfirmationRequired: true,
      intl,
    });
    const specific = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        alerts: ['The spender is known to be malicious.'],
      },
      unsignedMessage: permitMessage,
      intl,
    });

    expect(generic).toMatchObject({
      confirmation: 'none',
      status: 'success',
      findings: [],
    });
    expect(specific.confirmation).toBe('risk');
    expect(
      specific.findings.some((finding) => finding.id.includes('parser-alert')),
    ).toBe(true);
  });

  it.each([EHostSecurityLevel.High, EHostSecurityLevel.Medium] as const)(
    'keeps a trusted Permit at Prime %s as risk',
    (level) => {
      const model = buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: verifiedSite,
        messageDisplay: parsedMessage,
        unsignedMessage: permitMessage,
        transactionSecurityInfo: buildTransactionSecurityResult(level),
        intl,
      });
      expect(model.confirmation).toBe('risk');
    },
  );

  it.each(['Permit', 'Order'] as const)(
    'gates an unknown-site %s with no parser alert through isRiskSignMethod',
    (primaryType) => {
      const model = buildSecurityCheckModel({
        kind: 'message',
        origin: 'https://app.example.com',
        urlSecurityInfo: { level: EHostSecurityLevel.Unknown } as IHostSecurity,
        messageDisplay: parsedMessage,
        unsignedMessage: buildTypedDataMessage(primaryType),
        isRiskSignMethod: true,
        intl,
      });
      expect(model.confirmation).toBe('risk');
    },
  );

  it('keeps Security-site eth_sign gated by isRiskSignMethod', () => {
    // Intentional strengthening versus the historical Security short-circuit.
    const model = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      unsignedMessage: {
        type: EMessageTypesEth.ETH_SIGN,
        message: '0xdead',
      },
      isRiskSignMethod: true,
      intl,
    });
    expect(model.confirmation).toBe('risk');
    expect(model.findings).toContainEqual(
      expect.objectContaining({
        id: 'message-risk-sign-method',
        status: 'critical',
      }),
    );
  });

  it.each([
    ['transaction', EHostSecurityLevel.High, 'critical'],
    ['transaction', EHostSecurityLevel.Medium, 'warning'],
    ['message', EHostSecurityLevel.High, 'critical'],
    ['message', EHostSecurityLevel.Medium, 'warning'],
  ] as const)('gates a %s on site %s', (kind, level, status) => {
    const model = buildSecurityCheckModel({
      kind,
      origin: 'https://app.example.com',
      urlSecurityInfo: { ...verifiedSite, level } as IHostSecurity,
      ...(kind === 'transaction'
        ? { decodedTxs: [buildDecodedTx()] }
        : { messageDisplay: parsedMessage }),
      intl,
    });
    expect(model.confirmation).toBe('risk');
    expect(model.status).toBe(status);
  });

  it('keeps acknowledgement stable for ordinary display-only changes', () => {
    const baseTx = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-tx',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [buildDecodedTx({ isConfirmationRequired: true })],
      intl,
    });
    const withAlert = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-tx',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        buildDecodedTx({
          isConfirmationRequired: true,
          txDisplay: {
            title: 'Send',
            components: [],
            alerts: ['The spender is an EOA'],
          },
        }),
      ],
      intl,
    });
    const withHex = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-tx',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        buildDecodedTx({ isConfirmationRequired: true, isCustomHexData: true }),
      ],
      intl,
    });
    const withTag = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-tx',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [
        buildDecodedTx({
          isConfirmationRequired: true,
          txDisplay: {
            title: 'Send',
            components: [buildAddressComponent({ displayType: 'warning' })],
            alerts: [],
          },
        }),
      ],
      intl,
    });
    const baseMessage = buildSecurityCheckModel({
      kind: 'message',
      requestKey: 'same-message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isConfirmationRequired: true,
      intl,
    });
    const taggedMessage = buildSecurityCheckModel({
      kind: 'message',
      requestKey: 'same-message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: {
        ...parsedMessage,
        components: [buildAddressComponent({ displayType: 'critical' })],
      },
      isConfirmationRequired: true,
      intl,
    });

    expect(baseTx.confirmation).toBe('risk');
    expect(baseMessage.confirmation).toBe('risk');
    expect(withAlert.acknowledgementKey).toBe(baseTx.acknowledgementKey);
    expect(withHex.acknowledgementKey).toBe(baseTx.acknowledgementKey);
    expect(withTag.acknowledgementKey).toBe(baseTx.acknowledgementKey);
    expect(taggedMessage.acknowledgementKey).toBe(
      baseMessage.acknowledgementKey,
    );
  });

  it('invalidates acknowledgement when pending, request, or risk reasons change', () => {
    const messageWithAlert = (alert: string) =>
      buildSecurityCheckModel({
        kind: 'message',
        requestKey: 'same-request',
        origin: 'https://app.example.com',
        urlSecurityInfo: {
          ...verifiedSite,
          level: EHostSecurityLevel.Unknown,
        },
        messageDisplay: { ...parsedMessage, alerts: [alert] },
        intl,
      });
    const firstAlert = messageWithAlert('The spender is an EOA');
    const secondAlert = messageWithAlert(
      'The spender is known to be malicious',
    );
    expect(firstAlert.confirmation).toBe('risk');
    expect(secondAlert.confirmation).toBe('risk');
    expect(secondAlert.acknowledgementKey).not.toBe(
      firstAlert.acknowledgementKey,
    );
    const pending = buildSecurityCheckModel({
      kind: 'message',
      requestKey: 'same-request',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isTransactionSecurityPending: true,
      intl,
    });
    const resolved = buildSecurityCheckModel({
      kind: 'message',
      requestKey: 'same-request',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      intl,
    });
    const fallback = buildSecurityCheckModel({
      kind: 'message',
      requestKey: 'same-request',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isMessageParseFallback: true,
      intl,
    });
    const primeMedium = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-request',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [buildDecodedTx()],
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.Medium,
      ),
      intl,
    });
    const primeHigh = buildSecurityCheckModel({
      kind: 'transaction',
      requestKey: 'same-request',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      decodedTxs: [buildDecodedTx()],
      transactionSecurityInfo: buildTransactionSecurityResult(
        EHostSecurityLevel.High,
      ),
      intl,
    });

    expect(pending.acknowledgementKey).not.toBe(resolved.acknowledgementKey);
    expect(fallback.acknowledgementKey).not.toBe(resolved.acknowledgementKey);
    expect(primeHigh.acknowledgementKey).not.toBe(
      primeMedium.acknowledgementKey,
    );
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
      isTransactionSecurityApplicable: true,
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
      isTransactionSecurityApplicable: false,
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
      isTransactionSecurityApplicable: false,
    });

    expect(coverage).toEqual([
      { source: 'site', state: 'notApplicable' },
      { source: 'parser', state: 'notApplicable' },
      { source: 'requestScan', state: 'notApplicable' },
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
});

describe('security check display helpers', () => {
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
      { source: 'requestScan', state: 'notApplicable' },
    ]);
    expect(model.showPrimeInvite).toBe(false);

    const eligibleModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isPrimeUser: false,
      isTransactionSecurityApplicable: true,
      intl,
    });
    const unsupportedModel = buildSecurityCheckModel({
      kind: 'message',
      origin: 'https://app.example.com',
      urlSecurityInfo: verifiedSite,
      messageDisplay: parsedMessage,
      isPrimeUser: false,
      isTransactionSecurityApplicable: false,
      intl,
    });

    expect(eligibleModel.showPrimeInvite).toBe(true);
    expect(unsupportedModel.showPrimeInvite).toBe(false);
  });

  it('limits decision findings and keeps non-decision context visible', () => {
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

    expect(card.visibleFindings.map((finding) => finding.id)).toEqual([
      'site-medium',
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
