import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';
import {
  hasTransactionSecurityFeatures,
  isTransactionSecurityCheckFailed,
  isTransactionSecurityCheckUnavailable,
  isTransactionSecurityNetworkNotSupported,
} from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';
import {
  ETransactionSecurityResultCode,
  type ITransactionSecurityCheckResult,
} from '@onekeyhq/shared/types/transactionSecurity';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getCustomHexDataAlertTitleIds } from '../CustomHexDataAlert/utils';

import {
  getAddressRiskStatus,
  getParserAlertDisplay,
  normalizeAlertText,
  normalizeSecurityFindingTitle,
  shouldHideGenericPermitAlert,
  shouldShowNoIssueSection,
} from './utils';

import type { IntlShape } from 'react-intl';

export type ISecurityCheckKind = 'transaction' | 'message';

export type ISecurityCheckCategory = 'site' | 'operation';

type ISecurityCheckFindingStatus = 'critical' | 'warning' | 'unknown' | 'info';

export type ISecurityCheckStatus =
  | ISecurityCheckFindingStatus
  | 'success'
  | 'loading'
  | 'check_failed';

const CHECK_FAILED_FINDING_ID = 'tx-security-check-failed';

const SECURITY_CHECK_STATUS_WEIGHT: Record<ISecurityCheckStatus, number> = {
  critical: 5,
  warning: 4,
  unknown: 3,
  check_failed: 3,
  info: 2,
  success: 1,
  loading: 0,
};

const CATEGORY_ORDER: ISecurityCheckCategory[] = ['site', 'operation'];

export type ISecurityCheckConfirmation =
  | 'none'
  | 'pending'
  | 'request'
  | 'risk';

type ISecurityCheckFindingAction =
  | {
      type: 'site';
      origin: string;
      urlSecurityInfo: IHostSecurity;
    }
  | {
      type: 'transactionSecurity';
      result: ITransactionSecurityCheckResult;
    };

export type ISecurityCheckFinding = {
  id: string;
  category: ISecurityCheckCategory;
  status: ISecurityCheckFindingStatus;
  title: string;
  description?: string;
  action?: ISecurityCheckFindingAction;
};

export type ISecurityCheckCoverageSource = 'site' | 'parser' | 'requestScan';

export type ISecurityCheckCoverageState =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'unavailable'
  | 'networkUnsupported'
  | 'unknown'
  | 'notApplicable'
  | 'locked';

export type ISecurityCheckCoverageItem = {
  source: ISecurityCheckCoverageSource;
  state: ISecurityCheckCoverageState;
};

export type ISecurityCheckViewModel = {
  kind: ISecurityCheckKind;
  status?: ISecurityCheckStatus;
  confirmation: ISecurityCheckConfirmation;
  acknowledgementKey: string;
  findings: ISecurityCheckFinding[];
  coverage: ISecurityCheckCoverageItem[];
  isPending: boolean;
  showPrimeInvite: boolean;
};

type IIntl = Pick<IntlShape, 'formatMessage'>;

type IBuildSecurityCheckModelParams = {
  kind: ISecurityCheckKind;
  requestKey?: string;
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  unsignedMessage?: IUnsignedMessage;
  isRiskSignMethod?: boolean;
  isConfirmationRequired?: boolean;
  isMessageParseFallback?: boolean;
  isParserPending?: boolean;
  transactionSecurityInfo?: ITransactionSecurityCheckResult;
  isTransactionSecurityPending?: boolean;
  isTransactionSecurityApplicable?: boolean;
  isPrimeUser?: boolean;
  intl: IIntl;
};

function isTransactionParseFallback(decodedTx: IDecodedTx) {
  return decodedTx.isLocalParsed && !decodedTx.hasServerSecurityAnalysis;
}

function getSiteCoverage({
  origin,
  urlSecurityInfo,
}: Pick<
  IBuildSecurityCheckModelParams,
  'origin' | 'urlSecurityInfo'
>): ISecurityCheckCoverageState {
  if (!origin) {
    return 'notApplicable';
  }
  if (!urlSecurityInfo?.level) {
    return 'pending';
  }
  return urlSecurityInfo.level === EHostSecurityLevel.Unknown
    ? 'unknown'
    : 'completed';
}

function getParserCoverage({
  kind,
  decodedTxs,
  messageDisplay,
  isMessageParseFallback,
  isParserPending,
}: Pick<
  IBuildSecurityCheckModelParams,
  | 'kind'
  | 'decodedTxs'
  | 'messageDisplay'
  | 'isMessageParseFallback'
  | 'isParserPending'
>): ISecurityCheckCoverageState {
  if (isParserPending) {
    return 'pending';
  }
  if (kind === 'transaction') {
    if (!decodedTxs?.length) {
      return 'notApplicable';
    }
    return decodedTxs.some(isTransactionParseFallback)
      ? 'unknown'
      : 'completed';
  }
  if (!messageDisplay) {
    return 'notApplicable';
  }
  return isMessageParseFallback ? 'unknown' : 'completed';
}

function getRequestScanCoverage({
  isPrimeUser,
  isTransactionSecurityPending,
  isTransactionSecurityApplicable,
  transactionSecurityInfo,
}: Pick<
  IBuildSecurityCheckModelParams,
  | 'isPrimeUser'
  | 'isTransactionSecurityPending'
  | 'isTransactionSecurityApplicable'
  | 'transactionSecurityInfo'
>): ISecurityCheckCoverageState {
  if (isTransactionSecurityPending) {
    return 'pending';
  }
  if (transactionSecurityInfo) {
    if (isTransactionSecurityCheckUnavailable(transactionSecurityInfo)) {
      return 'unavailable';
    }
    if (isTransactionSecurityNetworkNotSupported(transactionSecurityInfo)) {
      return 'networkUnsupported';
    }
    if (isTransactionSecurityCheckFailed(transactionSecurityInfo)) {
      return 'failed';
    }
    if (transactionSecurityInfo.coverage?.hasFailedRequests) {
      return 'failed';
    }
    if (transactionSecurityInfo.coverage?.hasUncoveredRequests) {
      return 'unknown';
    }
    return transactionSecurityInfo.level === EHostSecurityLevel.Unknown
      ? 'unknown'
      : 'completed';
  }
  if (isTransactionSecurityApplicable !== true) {
    return 'notApplicable';
  }
  return isPrimeUser === false ? 'locked' : 'notApplicable';
}

export function getSecurityCheckCoverage(
  params: Pick<
    IBuildSecurityCheckModelParams,
    | 'kind'
    | 'origin'
    | 'urlSecurityInfo'
    | 'decodedTxs'
    | 'messageDisplay'
    | 'isMessageParseFallback'
    | 'isParserPending'
    | 'transactionSecurityInfo'
    | 'isTransactionSecurityPending'
    | 'isTransactionSecurityApplicable'
    | 'isPrimeUser'
  >,
): ISecurityCheckCoverageItem[] {
  return [
    { source: 'site', state: getSiteCoverage(params) },
    { source: 'parser', state: getParserCoverage(params) },
    { source: 'requestScan', state: getRequestScanCoverage(params) },
  ];
}

function isCheckFailedFinding(finding: ISecurityCheckFinding) {
  return finding.id === CHECK_FAILED_FINDING_ID;
}

export function canRetryTransactionSecurityCheck(
  findings: ISecurityCheckFinding[],
) {
  return findings.some(isCheckFailedFinding);
}

function shouldUseCheckFailedStatus(findings: ISecurityCheckFinding[]) {
  if (!findings.some(isCheckFailedFinding)) {
    return false;
  }
  return !findings.some(
    (finding) =>
      !isCheckFailedFinding(finding) &&
      (finding.status === 'critical' ||
        finding.status === 'warning' ||
        finding.status === 'unknown'),
  );
}

function isDecisionSecurityFinding(finding: ISecurityCheckFinding) {
  return finding.status === 'critical' || finding.status === 'warning';
}

export function sortSecurityFindings(findings: ISecurityCheckFinding[]) {
  return findings.toSorted((a, b) => {
    const weightDiff =
      SECURITY_CHECK_STATUS_WEIGHT[b.status] -
      SECURITY_CHECK_STATUS_WEIGHT[a.status];
    if (weightDiff !== 0) {
      return weightDiff;
    }
    return (
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    );
  });
}

const CARD_DECISION_FINDING_LIMIT = 3;

export function getCardSecurityFindings(findings: ISecurityCheckFinding[]) {
  const sortedFindings = sortSecurityFindings(findings);
  const decisionFindings = sortedFindings.filter(isDecisionSecurityFinding);
  const visibleFindings = [
    ...decisionFindings.slice(0, CARD_DECISION_FINDING_LIMIT),
    ...sortedFindings.filter((finding) => !isDecisionSecurityFinding(finding)),
  ];
  return {
    allDecisionFindings: decisionFindings,
    visibleFindings,
    hasHiddenDecisionFindings:
      decisionFindings.length > CARD_DECISION_FINDING_LIMIT,
  };
}

function getCeremonialFindingDescriptions(intl: IIntl) {
  return [
    intl.formatMessage({ id: ETranslations.global_an_error_occurred_desc }),
    intl.formatMessage({
      id: ETranslations.dapp_connect_security_checks_tx_review_required__desc,
    }),
    intl.formatMessage({
      id: ETranslations.dapp_connect_security_checks_signature_review_required__desc,
    }),
  ];
}

function omitCeremonialDescription(
  content: string | undefined,
  ceremonial: string[],
) {
  const text = content?.trim();
  if (!text || ceremonial.includes(text)) {
    return undefined;
  }
  return text;
}

const SITE_RISK_FINDING_CONFIG: Partial<
  Record<
    EHostSecurityLevel,
    {
      id: string;
      status: ISecurityCheckFindingStatus;
      titleId: ETranslations;
    }
  >
> = {
  [EHostSecurityLevel.High]: {
    id: 'site-high',
    status: 'critical',
    titleId: ETranslations.dapp_connect_malicious_site_warning,
  },
  [EHostSecurityLevel.Medium]: {
    id: 'site-medium',
    status: 'warning',
    titleId: ETranslations.dapp_connect_suspected_malicious_behavior,
  },
};

function getSiteFinding({
  origin,
  urlSecurityInfo,
  intl,
}: Pick<
  IBuildSecurityCheckModelParams,
  'origin' | 'urlSecurityInfo' | 'intl'
>): ISecurityCheckFinding | undefined {
  if (!origin || !urlSecurityInfo?.level) {
    return undefined;
  }

  const riskFindingConfig = SITE_RISK_FINDING_CONFIG[urlSecurityInfo.level];
  if (riskFindingConfig) {
    return {
      id: riskFindingConfig.id,
      category: 'site',
      status: riskFindingConfig.status,
      title:
        urlSecurityInfo.alert ||
        intl.formatMessage({ id: riskFindingConfig.titleId }),
      action: urlSecurityInfo.detail
        ? { type: 'site', origin, urlSecurityInfo }
        : undefined,
    };
  }

  if (urlSecurityInfo.level === EHostSecurityLevel.Security) {
    return undefined;
  }

  return {
    id: 'site-unknown',
    category: 'site',
    status: 'unknown',
    title: intl.formatMessage({ id: ETranslations.global_unverified }),
  };
}

function getTransactionSecurityFinding({
  transactionSecurityInfo,
  intl,
}: Pick<IBuildSecurityCheckModelParams, 'transactionSecurityInfo' | 'intl'>):
  | ISecurityCheckFinding
  | undefined {
  if (
    !transactionSecurityInfo ||
    transactionSecurityInfo.level === EHostSecurityLevel.Security ||
    isTransactionSecurityCheckUnavailable(transactionSecurityInfo) ||
    isTransactionSecurityNetworkNotSupported(transactionSecurityInfo)
  ) {
    return undefined;
  }

  const ceremonial = getCeremonialFindingDescriptions(intl);

  if (isTransactionSecurityCheckFailed(transactionSecurityInfo)) {
    return {
      id: CHECK_FAILED_FINDING_ID,
      category: 'operation',
      status: 'unknown',
      title: intl.formatMessage({
        id: ETranslations.transaction_security_check_incomplete__title,
      }),
      description: omitCeremonialDescription(
        transactionSecurityInfo.detail.content,
        ceremonial,
      ),
    };
  }

  let fallbackTitleId =
    ETranslations.dapp_connect_security_checks_risk_review_required__title;
  if (
    transactionSecurityInfo.detail.code ===
    ETransactionSecurityResultCode.UnableToAssess
  ) {
    fallbackTitleId =
      ETranslations.transaction_security_unable_to_assess__title;
  } else if (transactionSecurityInfo.level === EHostSecurityLevel.Unknown) {
    fallbackTitleId = ETranslations.global_unverified;
  }
  const title =
    transactionSecurityInfo.detail.title?.trim() ||
    intl.formatMessage({ id: fallbackTitleId });
  const description = omitCeremonialDescription(
    transactionSecurityInfo.detail.content,
    ceremonial,
  );
  let status: ISecurityCheckFindingStatus = 'unknown';
  if (transactionSecurityInfo.level === EHostSecurityLevel.High) {
    status = 'critical';
  } else if (transactionSecurityInfo.level === EHostSecurityLevel.Medium) {
    status = 'warning';
  }

  return {
    id: `tx-security-${transactionSecurityInfo.detail.code}`,
    category: 'operation',
    status,
    title,
    description,
    action: hasTransactionSecurityFeatures(transactionSecurityInfo)
      ? {
          type: 'transactionSecurity',
          result: transactionSecurityInfo,
        }
      : undefined,
  };
}

function getTransactionSecurityCoverageFinding({
  transactionSecurityInfo,
  requestScanCoverage,
  intl,
}: Pick<IBuildSecurityCheckModelParams, 'transactionSecurityInfo' | 'intl'> & {
  requestScanCoverage: ISecurityCheckCoverageState;
}): ISecurityCheckFinding | undefined {
  if (
    !transactionSecurityInfo ||
    transactionSecurityInfo.level === EHostSecurityLevel.Unknown ||
    isTransactionSecurityCheckFailed(transactionSecurityInfo)
  ) {
    return undefined;
  }
  if (requestScanCoverage === 'failed') {
    return {
      id: CHECK_FAILED_FINDING_ID,
      category: 'operation',
      status: 'unknown',
      title: intl.formatMessage({
        id: ETranslations.transaction_security_check_incomplete__title,
      }),
    };
  }
  if (requestScanCoverage === 'unknown') {
    return {
      id: 'tx-security-partial-coverage',
      category: 'operation',
      status: 'unknown',
      title: intl.formatMessage({ id: ETranslations.global_unverified }),
    };
  }
  return undefined;
}

function getCustomHexFindings({
  decodedTxs,
  intl,
}: Pick<
  IBuildSecurityCheckModelParams,
  'decodedTxs' | 'intl'
>): ISecurityCheckFinding[] {
  const findings: ISecurityCheckFinding[] = [];
  const seenTitleIds = new Set<ETranslations>();
  decodedTxs
    ?.filter((decodedTx) => decodedTx.isCustomHexData)
    .forEach((decodedTx) => {
      getCustomHexDataAlertTitleIds(decodedTx).forEach((titleId) => {
        if (seenTitleIds.has(titleId)) {
          return;
        }
        seenTitleIds.add(titleId);
        findings.push({
          id: `custom-hex-${titleId}`,
          category: 'operation',
          status: 'warning',
          title: intl.formatMessage({ id: titleId }),
        });
      });
    });
  return findings;
}

function isEquivalentParserAlert(
  alert: string,
  finding: ISecurityCheckFinding,
) {
  const normalizedAlert = normalizeAlertText(alert);
  if (!normalizedAlert) {
    return false;
  }

  return [finding.title, finding.description].some((text) => {
    const normalizedText = normalizeAlertText(text);
    return normalizedText && normalizedAlert === normalizedText;
  });
}

function dedupeAlertTexts(alerts: string[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = normalizeAlertText(alert);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getOperationFindings({
  kind,
  origin,
  decodedTxs,
  messageDisplay,
  unsignedMessage,
  isRiskSignMethod,
  isMessageParseFallback,
  urlSecurityInfo,
  intl,
}: IBuildSecurityCheckModelParams): ISecurityCheckFinding[] {
  const findings: ISecurityCheckFinding[] = [];
  const isPermitSignMethod =
    kind === 'message' && unsignedMessage
      ? isPrimaryTypePermitSign({ unsignedMessage })
      : false;
  const isSiteVerified = urlSecurityInfo?.level === EHostSecurityLevel.Security;
  const parserAlerts =
    kind === 'transaction'
      ? (decodedTxs?.flatMap(
          (decodedTx) => decodedTx.txDisplay?.alerts ?? [],
        ) ?? [])
      : (messageDisplay?.alerts ?? []);
  const genericPermitAlert = intl.formatMessage({
    id: ETranslations.dapp_connect_permit_sign_alert,
  });
  const validParserAlerts = dedupeAlertTexts(
    parserAlerts.filter(Boolean),
  ).filter(
    (alert) =>
      !shouldHideGenericPermitAlert({
        alert,
        genericPermitAlert,
        isPermitSignMethod,
        isSiteVerified,
      }),
  );
  const localMessageFindings: ISecurityCheckFinding[] = [];

  if (kind === 'message' && unsignedMessage) {
    const isTypedData =
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;
    const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });

    if (isTypedData && !isSiteVerified) {
      if (isPermitSignMethod) {
        localMessageFindings.push({
          id: 'message-permit',
          category: 'operation',
          status: 'warning',
          title: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_permit_signature_request__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_permit_sign_alert,
          }),
        });
      } else if (isOrderSignMethod) {
        localMessageFindings.push({
          id: 'message-order',
          category: 'operation',
          status: 'warning',
          title: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_order_signature_request__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_order_signature_request__desc,
          }),
        });
      } else {
        localMessageFindings.push({
          id: 'message-typed-data',
          category: 'operation',
          status: isRiskSignMethod ? 'warning' : 'info',
          title: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_typed_data_signature_request__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_typed_data_signature_request__desc,
          }),
        });
      }
    }

    if (isRiskSignMethod && !isTypedData) {
      localMessageFindings.push({
        id: 'message-risk-sign-method',
        category: 'operation',
        status: 'critical',
        title: intl.formatMessage({
          id: ETranslations.dapp_connect_security_checks_risky_signature_method__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.dapp_connect_risk_sign,
        }),
      });
    }
  }

  const customHexFindings = getCustomHexFindings({ decodedTxs, intl });
  const localOperationFindings = [
    ...localMessageFindings,
    ...customHexFindings,
  ];

  validParserAlerts
    .filter(
      (alert) =>
        !localOperationFindings.some((finding) =>
          isEquivalentParserAlert(alert, finding),
        ),
    )
    .forEach((alert, index) => {
      const { title, description } = getParserAlertDisplay(alert);
      findings.push({
        id: `parser-alert-${index}-${alert}`,
        category: 'operation',
        status: 'warning',
        title,
        description,
      });
    });

  findings.push(...localMessageFindings);

  if (kind === 'message' && isMessageParseFallback) {
    findings.push({
      id: 'message-parse-fallback',
      category: 'operation',
      status: 'unknown',
      title: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_review_raw_message_data__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_review_raw_message_data__desc,
      }),
    });
  }

  if (
    kind === 'transaction' &&
    origin &&
    decodedTxs?.some(isTransactionParseFallback)
  ) {
    findings.push({
      id: 'tx-parse-fallback',
      category: 'operation',
      status: 'unknown',
      title: intl.formatMessage({ id: ETranslations.global_unverified }),
    });
  }

  findings.push(...customHexFindings);
  return findings;
}

function dedupeFindings(findings: ISecurityCheckFinding[]) {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) {
      return false;
    }
    seen.add(finding.id);
    return true;
  });
}

function getHighestFindingStatus(findings: ISecurityCheckFinding[]) {
  return findings.reduce<ISecurityCheckFindingStatus | undefined>(
    (status, finding) =>
      !status ||
      SECURITY_CHECK_STATUS_WEIGHT[finding.status] >
        SECURITY_CHECK_STATUS_WEIGHT[status]
        ? finding.status
        : status,
    undefined,
  );
}

function getDisplayComponents({
  decodedTxs,
  messageDisplay,
}: IBuildSecurityCheckModelParams) {
  return (
    decodedTxs?.flatMap((decodedTx) => decodedTx.txDisplay?.components ?? []) ??
    []
  ).concat(messageDisplay?.components ?? []);
}

export function buildSecurityCheckModel(
  params: IBuildSecurityCheckModelParams,
): ISecurityCheckViewModel {
  const {
    kind,
    decodedTxs,
    unsignedMessage,
    urlSecurityInfo,
    isConfirmationRequired,
    isRiskSignMethod,
    isMessageParseFallback,
    transactionSecurityInfo,
  } = params;
  const coverage = getSecurityCheckCoverage(params);
  const requestScanCoverage =
    coverage.find(({ source }) => source === 'requestScan')?.state ??
    'notApplicable';
  const siteCoverage = coverage.find(({ source }) => source === 'site')?.state;
  const parserCoverage = coverage.find(
    ({ source }) => source === 'parser',
  )?.state;
  const findings = dedupeFindings(
    [
      getSiteFinding(params),
      getTransactionSecurityFinding(params),
      getTransactionSecurityCoverageFinding({
        transactionSecurityInfo,
        requestScanCoverage,
        intl: params.intl,
      }),
      ...getOperationFindings(params),
    ].filter((finding): finding is ISecurityCheckFinding => Boolean(finding)),
  ).map((finding) => ({
    ...finding,
    title: normalizeSecurityFindingTitle(finding.title),
  }));
  const highestFindingStatus = getHighestFindingStatus(findings);
  const addressRiskStatus = getAddressRiskStatus(getDisplayComponents(params));
  const hasConclusiveRequestScan = Boolean(
    transactionSecurityInfo && requestScanCoverage === 'completed',
  );
  // A conclusive request scan owns the verdict for this payload. Address tags
  // remain visible on their rows and are the fallback when that scan has no
  // usable conclusion.
  const effectiveAddressRiskStatus = hasConclusiveRequestScan
    ? undefined
    : addressRiskStatus;
  const highestStatus =
    effectiveAddressRiskStatus &&
    (!highestFindingStatus ||
      SECURITY_CHECK_STATUS_WEIGHT[effectiveAddressRiskStatus] >
        SECURITY_CHECK_STATUS_WEIGHT[highestFindingStatus])
      ? effectiveAddressRiskStatus
      : highestFindingStatus;
  const isSecurityCheckPending = coverage.some(
    ({ state }) => state === 'pending',
  );
  const shouldShowNoIssue = shouldShowNoIssueSection({
    hasCardFindings: findings.some((finding) => finding.status !== 'info'),
    hasResolvedRequiredChecks:
      (siteCoverage === 'completed' || siteCoverage === 'unknown') &&
      parserCoverage === 'completed',
    isSecurityCheckPending,
  });
  const hasRiskFinding =
    highestStatus === 'critical' || highestStatus === 'warning';
  const isTrustedPermit =
    kind === 'message' &&
    Boolean(
      unsignedMessage &&
      isPrimaryTypePermitSign({ unsignedMessage }) &&
      urlSecurityInfo?.level === EHostSecurityLevel.Security,
    );
  const requestNeedsConfirmation =
    kind === 'transaction'
      ? Boolean(
          params.origin && decodedTxs?.some(isTransactionParseFallback),
        ) || decodedTxs?.some((decodedTx) => decodedTx.isConfirmationRequired)
      : Boolean(
          isMessageParseFallback ||
          (isConfirmationRequired && !isTrustedPermit),
        );
  let confirmation: ISecurityCheckConfirmation = 'none';
  if (isSecurityCheckPending) {
    confirmation = 'pending';
  } else if (
    hasRiskFinding ||
    (kind === 'message' && isRiskSignMethod && !isTrustedPermit)
  ) {
    confirmation = 'risk';
  } else if (requestNeedsConfirmation) {
    confirmation = 'request';
  }
  let status: ISecurityCheckStatus | undefined = highestStatus;
  if (
    isSecurityCheckPending &&
    (!status || shouldUseCheckFailedStatus(findings))
  ) {
    status = 'loading';
  } else if ((!status || status === 'info') && shouldShowNoIssue) {
    status = 'success';
  } else if (
    shouldUseCheckFailedStatus(findings) &&
    (!status || status === 'unknown')
  ) {
    status = 'check_failed';
  }
  const showPrimeInvite = Boolean(
    requestScanCoverage === 'locked' &&
    (status === 'success' || status === 'info'),
  );
  const acknowledgementKey = stableStringify({
    requestKey: params.requestKey ?? '',
    kind,
    confirmation,
    findings: findings.filter(isDecisionSecurityFinding),
  });

  return {
    kind,
    status,
    confirmation,
    acknowledgementKey,
    findings,
    coverage,
    isPending: isSecurityCheckPending,
    showPrimeInvite,
  };
}
