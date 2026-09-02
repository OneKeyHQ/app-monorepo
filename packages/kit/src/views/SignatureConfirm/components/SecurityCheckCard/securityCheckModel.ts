import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import { hasTransactionSecurityFeatures } from '@onekeyhq/shared/src/utils/transactionSecurityUtils';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';
import type { ITransactionSecurityCheckResult } from '@onekeyhq/shared/types/transactionSecurity';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getCustomHexDataAlertTitleIds } from '../CustomHexDataAlert/utils';

import {
  getAddressRiskStatus,
  getParserAlertDisplay,
  shouldHideGenericPermitAlert,
  shouldShowNoIssueSection,
} from './utils';

import type { IntlShape } from 'react-intl';

export type ISecurityCheckKind = 'transaction' | 'message';

export type ISecurityCheckCategory = 'site' | 'operation';

export type ISecurityCheckFindingStatus =
  | 'critical'
  | 'warning'
  | 'unknown'
  | 'info';

export type ISecurityCheckStatus =
  | ISecurityCheckFindingStatus
  | 'success'
  | 'loading';

export type ISecurityCheckConfirmation =
  | 'none'
  | 'pending'
  | 'request'
  | 'risk';

export type ISecurityCheckFindingAction =
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
  isPrimeSecurityCheck?: boolean;
  action?: ISecurityCheckFindingAction;
};

export type ISecurityCheckViewModel = {
  kind: ISecurityCheckKind;
  status?: ISecurityCheckStatus;
  confirmation: ISecurityCheckConfirmation;
  findings: ISecurityCheckFinding[];
  groupedFindings: Record<ISecurityCheckCategory, ISecurityCheckFinding[]>;
  orderedCategories: ISecurityCheckCategory[];
  coverageTitle: string;
  statusSourceTitle: string;
  isPending: boolean;
  hasTransactionSecurityCheck: boolean;
  shouldShowNoIssue: boolean;
  defaultExpanded: boolean;
};

type IIntl = Pick<IntlShape, 'formatMessage'>;

type IBuildSecurityCheckModelParams = {
  kind: ISecurityCheckKind;
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  unsignedMessage?: IUnsignedMessage;
  isRiskSignMethod?: boolean;
  isConfirmationRequired?: boolean;
  isMessageParseFallback?: boolean;
  transactionSecurityInfo?: ITransactionSecurityCheckResult;
  isTransactionSecurityPending?: boolean;
  intl: IIntl;
};

export const SECURITY_CHECK_STATUS_WEIGHT: Record<
  ISecurityCheckStatus,
  number
> = {
  critical: 5,
  warning: 4,
  unknown: 3,
  info: 2,
  success: 1,
  loading: 0,
};

const CATEGORY_ORDER: ISecurityCheckCategory[] = ['site', 'operation'];

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
  kind,
  transactionSecurityInfo,
  intl,
}: Pick<
  IBuildSecurityCheckModelParams,
  'kind' | 'transactionSecurityInfo' | 'intl'
>): ISecurityCheckFinding | undefined {
  if (
    !transactionSecurityInfo ||
    transactionSecurityInfo.level === EHostSecurityLevel.Security
  ) {
    return undefined;
  }

  const fallbackTitleId =
    transactionSecurityInfo.level === EHostSecurityLevel.Unknown
      ? ETranslations.global_unverified
      : ETranslations.dapp_connect_security_checks_risk_review_required__title;
  const title =
    transactionSecurityInfo.detail.title?.trim() ||
    intl.formatMessage({ id: fallbackTitleId });
  const description =
    transactionSecurityInfo.detail.content?.trim() ||
    (transactionSecurityInfo.level === EHostSecurityLevel.Unknown
      ? undefined
      : intl.formatMessage({
          id:
            kind === 'message'
              ? ETranslations.dapp_connect_security_checks_signature_review_required__desc
              : ETranslations.dapp_connect_security_checks_tx_review_required__desc,
        }));
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
    isPrimeSecurityCheck: true,
    action: hasTransactionSecurityFeatures(transactionSecurityInfo)
      ? {
          type: 'transactionSecurity',
          result: transactionSecurityInfo,
        }
      : undefined,
  };
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

function normalizeAlertText(text?: string) {
  return text?.trim().replace(/\s+/g, ' ').toLowerCase() ?? '';
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
        isSiteVerified: urlSecurityInfo?.level === EHostSecurityLevel.Security,
      }),
  );
  const localMessageFindings: ISecurityCheckFinding[] = [];

  if (kind === 'message' && unsignedMessage) {
    const isTypedData =
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;
    const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });

    if (isTypedData) {
      if (isPermitSignMethod) {
        localMessageFindings.push({
          id: 'message-permit',
          category: 'operation',
          status: 'info',
          title: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_permit_signature_request__title,
          }),
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_security_checks_permit_authorization__desc,
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
    decodedTxs?.some((decodedTx) => decodedTx.isLocalParsed)
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

function sortFindingsByStatus(findings: ISecurityCheckFinding[]) {
  return findings.toSorted((a, b) => {
    if (a.isPrimeSecurityCheck !== b.isPrimeSecurityCheck) {
      return a.isPrimeSecurityCheck ? -1 : 1;
    }
    return (
      SECURITY_CHECK_STATUS_WEIGHT[b.status] -
      SECURITY_CHECK_STATUS_WEIGHT[a.status]
    );
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

function getCategorySourceLabel({
  category,
  kind,
  intl,
}: {
  category: ISecurityCheckCategory;
  kind: ISecurityCheckKind;
  intl: IIntl;
}) {
  let id = ETranslations.dapp_connect_transaction_analysis__title;
  if (category === 'site') {
    id = ETranslations.dapp_connect_site_security__title;
  } else if (kind === 'message') {
    id = ETranslations.dapp_connect_signature_analysis__title;
  }
  return intl.formatMessage({ id });
}

function getCoverageTitle({
  kind,
  origin,
  urlSecurityInfo,
  decodedTxs,
  messageDisplay,
  intl,
}: IBuildSecurityCheckModelParams) {
  const labels: string[] = [];
  if (origin && urlSecurityInfo?.level) {
    labels.push(
      intl.formatMessage({
        id: ETranslations.dapp_connect_site_security__title,
      }),
    );
  }
  if (kind === 'transaction' && decodedTxs?.length) {
    labels.push(
      intl.formatMessage({
        id: ETranslations.dapp_connect_transaction_analysis__title,
      }),
    );
  }
  if (kind === 'message' && messageDisplay) {
    labels.push(
      intl.formatMessage({
        id: ETranslations.dapp_connect_signature_analysis__title,
      }),
    );
  }
  return labels.join(' · ');
}

function hasResolvedRequiredChecks({
  kind,
  origin,
  urlSecurityInfo,
  decodedTxs,
  messageDisplay,
  isMessageParseFallback,
}: IBuildSecurityCheckModelParams) {
  if (!origin) {
    return false;
  }
  const siteResolved = Boolean(urlSecurityInfo?.level);
  const operationResolved =
    kind === 'transaction'
      ? Boolean(decodedTxs?.length) &&
        !decodedTxs?.some((decodedTx) => decodedTx.isLocalParsed)
      : Boolean(messageDisplay) && !isMessageParseFallback;
  return siteResolved && operationResolved;
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
    isTransactionSecurityPending,
    transactionSecurityInfo,
    intl,
  } = params;
  const findings = dedupeFindings(
    [
      getSiteFinding(params),
      getTransactionSecurityFinding(params),
      ...getOperationFindings(params),
    ].filter((finding): finding is ISecurityCheckFinding => Boolean(finding)),
  );
  const groupedFindings = {
    site: sortFindingsByStatus(
      findings.filter((finding) => finding.category === 'site'),
    ),
    operation: sortFindingsByStatus(
      findings.filter((finding) => finding.category === 'operation'),
    ),
  };
  const orderedCategories = CATEGORY_ORDER.filter(
    (category) => groupedFindings[category].length,
  ).toSorted((a, b) => {
    const highestA = getHighestFindingStatus(groupedFindings[a]);
    const highestB = getHighestFindingStatus(groupedFindings[b]);
    const weightDiff =
      (highestB ? SECURITY_CHECK_STATUS_WEIGHT[highestB] : 0) -
      (highestA ? SECURITY_CHECK_STATUS_WEIGHT[highestA] : 0);
    return weightDiff || CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
  });
  const highestFindingStatus = getHighestFindingStatus(findings);
  const addressRiskStatus = getAddressRiskStatus(getDisplayComponents(params));
  const hasAddressRisk = Boolean(addressRiskStatus);
  const highestStatus =
    addressRiskStatus &&
    (!highestFindingStatus ||
      SECURITY_CHECK_STATUS_WEIGHT[addressRiskStatus] >
        SECURITY_CHECK_STATUS_WEIGHT[highestFindingStatus])
      ? addressRiskStatus
      : highestFindingStatus;
  const coverageTitle = getCoverageTitle(params);
  const shouldShowNoIssue = shouldShowNoIssueSection({
    hasCardFindings: findings.some((finding) => finding.status !== 'info'),
    hasAddressRisk,
    hasResolvedRequiredChecks: hasResolvedRequiredChecks(params),
    hasCoverageTitle: Boolean(coverageTitle),
    isTransactionSecurityPending,
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
      ? decodedTxs?.some((decodedTx) => decodedTx.isConfirmationRequired)
      : isConfirmationRequired && !isTrustedPermit;
  let confirmation: ISecurityCheckConfirmation = 'none';
  if (isTransactionSecurityPending) {
    confirmation = 'pending';
  } else if (hasRiskFinding || hasAddressRisk) {
    confirmation = 'risk';
  } else if (requestNeedsConfirmation) {
    confirmation = 'request';
  }
  let status: ISecurityCheckStatus | undefined = highestStatus;
  if (!status && isTransactionSecurityPending) {
    status = 'loading';
  } else if ((!status || status === 'info') && shouldShowNoIssue) {
    status = 'success';
  }
  const statusSourceCategories = CATEGORY_ORDER.filter(
    (category) =>
      findings.some(
        (finding) => finding.category === category && finding.status === status,
      ) ||
      (category === 'operation' && addressRiskStatus === status),
  );
  const statusSourceTitle =
    status === 'success' || status === 'loading'
      ? coverageTitle
      : statusSourceCategories
          .map((category) => getCategorySourceLabel({ category, kind, intl }))
          .join(' · ') || coverageTitle;

  return {
    kind,
    status,
    confirmation,
    findings,
    groupedFindings,
    orderedCategories,
    coverageTitle,
    statusSourceTitle,
    isPending: Boolean(isTransactionSecurityPending),
    hasTransactionSecurityCheck: Boolean(
      transactionSecurityInfo || isTransactionSecurityPending,
    ),
    shouldShowNoIssue,
    defaultExpanded:
      hasAddressRisk ||
      findings.some(
        (finding) =>
          finding.status === 'critical' ||
          finding.status === 'warning' ||
          (finding.status === 'unknown' && finding.category !== 'site'),
      ),
  };
}
