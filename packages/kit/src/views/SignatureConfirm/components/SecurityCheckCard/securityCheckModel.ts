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
import { ADDRESS_RISK_TAG_DISPLAY_TYPES } from '@onekeyhq/shared/src/utils/txActionUtils';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EParseTxComponentType,
  type IDisplayComponent,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';
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

function isGenericConfirmationFinding(finding: ISecurityCheckFinding) {
  return (
    finding.id === 'tx-confirmation-required' ||
    finding.id === 'message-confirmation-required'
  );
}

function hasNonGenericOperationDecision(findings: ISecurityCheckFinding[]) {
  return findings.some(
    (finding) =>
      finding.category === 'operation' &&
      isDecisionSecurityFinding(finding) &&
      !isGenericConfirmationFinding(finding),
  );
}

function isRedundantUnknownFinding(
  finding: ISecurityCheckFinding,
  status?: ISecurityCheckStatus,
) {
  // Retry is bound to tx-security-check-failed by row id, so that finding is
  // never part of this whitelist. Unknown detail text and actions stay visible.
  return (
    status === 'unknown' &&
    finding.status === 'unknown' &&
    !finding.description?.trim() &&
    !finding.action &&
    (finding.id === 'site-unknown' ||
      finding.id === 'tx-parse-fallback' ||
      finding.id === 'tx-security-partial-coverage')
  );
}

function selectDisplaySecurityFindings(
  findings: ISecurityCheckFinding[],
  status?: ISecurityCheckStatus,
) {
  const hideGenericConfirmation = hasNonGenericOperationDecision(findings);
  return findings.filter((finding) => {
    if (finding.id === 'message-typed-data' && finding.status === 'info') {
      return false;
    }
    // Site-only risk must not hide the generic operation explanation.
    if (hideGenericConfirmation && isGenericConfirmationFinding(finding)) {
      return false;
    }
    return !isRedundantUnknownFinding(finding, status);
  });
}

export function getCardSecurityFindings(
  findings: ISecurityCheckFinding[],
  status?: ISecurityCheckStatus,
) {
  const sortedFindings = sortSecurityFindings(
    selectDisplaySecurityFindings(findings, status),
  );
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

function getCheckFailedFinding(
  intl: IIntl,
  description?: string,
): ISecurityCheckFinding {
  return {
    id: CHECK_FAILED_FINDING_ID,
    category: 'operation',
    status: 'unknown',
    title: intl.formatMessage({
      id: ETranslations.transaction_security_check_incomplete__title,
    }),
    ...(description ? { description } : {}),
  };
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
    return getCheckFailedFinding(
      intl,
      omitCeremonialDescription(
        transactionSecurityInfo.detail.content,
        ceremonial,
      ),
    );
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
    return getCheckFailedFinding(intl);
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

function isHostRiskLevel(level?: EHostSecurityLevel) {
  return (
    level === EHostSecurityLevel.High || level === EHostSecurityLevel.Medium
  );
}

function getPermitContext({
  kind,
  unsignedMessage,
  urlSecurityInfo,
}: Pick<
  IBuildSecurityCheckModelParams,
  'kind' | 'unsignedMessage' | 'urlSecurityInfo'
>) {
  const isPermitSignMethod = Boolean(
    kind === 'message' &&
    unsignedMessage &&
    isPrimaryTypePermitSign({ unsignedMessage }),
  );
  const isSiteVerified = urlSecurityInfo?.level === EHostSecurityLevel.Security;
  return {
    isPermitSignMethod,
    isSiteVerified,
    isTrustedPermit: isPermitSignMethod && isSiteVerified,
  };
}

function getValidParserAlerts(
  params: IBuildSecurityCheckModelParams,
  {
    isPermitSignMethod,
    isSiteVerified,
  }: Pick<
    ReturnType<typeof getPermitContext>,
    'isPermitSignMethod' | 'isSiteVerified'
  >,
) {
  const { kind, decodedTxs, messageDisplay, intl } = params;
  const parserAlerts =
    kind === 'transaction'
      ? (decodedTxs?.flatMap(
          (decodedTx) => decodedTx.txDisplay?.alerts ?? [],
        ) ?? [])
      : (messageDisplay?.alerts ?? []);
  const genericPermitAlert = intl.formatMessage({
    id: ETranslations.dapp_connect_permit_sign_alert,
  });
  return dedupeAlertTexts(parserAlerts.filter(Boolean)).filter(
    (alert) =>
      !shouldHideGenericPermitAlert({
        alert,
        genericPermitAlert,
        isPermitSignMethod,
        isSiteVerified,
      }),
  );
}

function getConfirmationCauses({
  params,
  isTrustedPermit,
  validParserAlerts,
  displayComponents,
  hasAddressRisk,
}: {
  params: IBuildSecurityCheckModelParams;
  isTrustedPermit: boolean;
  validParserAlerts: string[];
  displayComponents: IDisplayComponent[];
  hasAddressRisk: boolean;
}) {
  const {
    kind,
    origin,
    urlSecurityInfo,
    decodedTxs,
    isConfirmationRequired,
    isRiskSignMethod,
    transactionSecurityInfo,
  } = params;
  const causes: {
    site?: {
      origin: string;
      level: EHostSecurityLevel;
      alert: string;
      detail?: IHostSecurity['detail'];
      attackTypes: IHostSecurity['attackTypes'];
    };
    prime?: {
      level: EHostSecurityLevel;
      detail: ITransactionSecurityCheckResult['detail'];
    };
    txConfirmationRequired?: true;
    messageConfirmationRequired?: true;
    isRiskSignMethod?: true;
    parserAlerts?: string[];
    addressRisk?: {
      address: string;
      tags: {
        displayType: string;
        value: string;
        key?: string;
      }[];
    }[];
  } = {};

  if (origin && urlSecurityInfo && isHostRiskLevel(urlSecurityInfo.level)) {
    causes.site = {
      origin,
      level: urlSecurityInfo.level,
      alert: urlSecurityInfo.alert,
      detail: urlSecurityInfo.detail,
      attackTypes: urlSecurityInfo.attackTypes,
    };
  }

  if (
    transactionSecurityInfo &&
    !isTransactionSecurityCheckUnavailable(transactionSecurityInfo) &&
    !isTransactionSecurityNetworkNotSupported(transactionSecurityInfo) &&
    isHostRiskLevel(transactionSecurityInfo.level)
  ) {
    causes.prime = {
      level: transactionSecurityInfo.level,
      detail: transactionSecurityInfo.detail,
    };
  }

  if (
    kind === 'transaction' &&
    decodedTxs?.some((decodedTx) => decodedTx.isConfirmationRequired)
  ) {
    causes.txConfirmationRequired = true;
  }

  if (kind === 'message') {
    if (isTrustedPermit) {
      if (validParserAlerts.length) {
        causes.parserAlerts = validParserAlerts;
      }
      if (hasAddressRisk) {
        causes.addressRisk = displayComponents.flatMap((component) => {
          if (component.type !== EParseTxComponentType.Address) {
            return [];
          }
          const tags = (component.tags ?? [])
            .filter((tag) =>
              ADDRESS_RISK_TAG_DISPLAY_TYPES.has(tag.displayType),
            )
            .map((tag) => ({
              displayType: tag.displayType,
              value: tag.value,
              ...(tag.key ? { key: tag.key } : {}),
            }));
          return tags.length ? [{ address: component.address, tags }] : [];
        });
      }
    } else {
      if (isConfirmationRequired) {
        causes.messageConfirmationRequired = true;
      }
      // Security-site eth_sign still gates through isRiskSignMethod; that is an
      // intentional strengthening versus the historical Security short-circuit.
      if (isRiskSignMethod) {
        causes.isRiskSignMethod = true;
      }
      if (
        urlSecurityInfo?.level !== EHostSecurityLevel.Security &&
        validParserAlerts.length > 0
      ) {
        causes.parserAlerts = validParserAlerts;
      }
    }
  }

  return causes;
}

function getOperationFindings(
  params: IBuildSecurityCheckModelParams,
  {
    isPermitSignMethod,
    isSiteVerified,
    isTrustedPermit,
  }: ReturnType<typeof getPermitContext>,
  validParserAlerts: string[],
): ISecurityCheckFinding[] {
  const {
    kind,
    origin,
    decodedTxs,
    unsignedMessage,
    isRiskSignMethod,
    isConfirmationRequired,
    isMessageParseFallback,
    intl,
  } = params;
  const findings: ISecurityCheckFinding[] = [];
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

  if (
    kind === 'transaction' &&
    decodedTxs?.some((decodedTx) => decodedTx.isConfirmationRequired)
  ) {
    findings.push({
      id: 'tx-confirmation-required',
      category: 'operation',
      status: 'warning',
      title: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_risk_review_required__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_tx_review_required__desc,
      }),
    });
  }

  if (kind === 'message' && isConfirmationRequired && !isTrustedPermit) {
    findings.push({
      id: 'message-confirmation-required',
      category: 'operation',
      status: 'warning',
      title: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_risk_review_required__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.dapp_connect_security_checks_signature_review_required__desc,
      }),
    });
  }

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
  const { kind, decodedTxs, isMessageParseFallback, transactionSecurityInfo } =
    params;
  const coverage = getSecurityCheckCoverage(params);
  const requestScanCoverage =
    coverage.find(({ source }) => source === 'requestScan')?.state ??
    'notApplicable';
  const siteCoverage = coverage.find(({ source }) => source === 'site')?.state;
  const parserCoverage = coverage.find(
    ({ source }) => source === 'parser',
  )?.state;
  const permitContext = getPermitContext(params);
  const validParserAlerts = getValidParserAlerts(params, permitContext);
  const displayComponents = getDisplayComponents(params);
  const hasAddressRisk = Boolean(getAddressRiskStatus(displayComponents));
  const causes = getConfirmationCauses({
    params,
    isTrustedPermit: permitContext.isTrustedPermit,
    validParserAlerts,
    displayComponents,
    hasAddressRisk,
  });
  const findings = dedupeFindings(
    [
      getSiteFinding(params),
      getTransactionSecurityFinding(params),
      getTransactionSecurityCoverageFinding({
        transactionSecurityInfo,
        requestScanCoverage,
        intl: params.intl,
      }),
      ...getOperationFindings(params, permitContext, validParserAlerts),
    ].filter((finding): finding is ISecurityCheckFinding => Boolean(finding)),
  ).map((finding) => ({
    ...finding,
    title: normalizeSecurityFindingTitle(finding.title),
  }));
  const highestFindingStatus = getHighestFindingStatus(findings);
  const isSecurityCheckPending = coverage.some(
    ({ state }) => state === 'pending',
  );
  const shouldShowNoIssue = shouldShowNoIssueSection({
    hasCardFindings: findings.some((finding) => finding.status !== 'info'),
    hasAddressRisk,
    hasResolvedRequiredChecks:
      (siteCoverage === 'completed' || siteCoverage === 'unknown') &&
      parserCoverage === 'completed',
    isSecurityCheckPending,
  });
  // Confirmation follows explicit reasons, not card warning severity. Common
  // High/Medium site or Prime risk is evaluated before the trusted Permit
  // exemption. Tx parser/Hex findings and ordinary address tags are display-only.
  const hasRiskConfirmation = Boolean(
    causes.site ||
    causes.prime ||
    causes.txConfirmationRequired ||
    causes.messageConfirmationRequired ||
    causes.isRiskSignMethod ||
    causes.parserAlerts?.length ||
    causes.addressRisk?.length,
  );
  const requestNeedsConfirmation =
    kind === 'transaction'
      ? Boolean(params.origin && decodedTxs?.some(isTransactionParseFallback))
      : Boolean(isMessageParseFallback);
  let confirmation: ISecurityCheckConfirmation = 'none';
  if (isSecurityCheckPending) {
    confirmation = 'pending';
  } else if (hasRiskConfirmation) {
    confirmation = 'risk';
  } else if (requestNeedsConfirmation) {
    confirmation = 'request';
  }
  let status: ISecurityCheckStatus | undefined = highestFindingStatus;
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
    ...causes,
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
