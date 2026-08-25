import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Badge,
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  type IDisplayComponentSimulation,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { showDAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout';
import { SignatureConfirmTestIDs } from '../../testIDs';
import { getCustomHexDataAlertTitleIds } from '../CustomHexDataAlert/utils';
import { LaserBorder } from '../SignatureConfirmComponents/LaserBorder';
import { ShimmerSignGuard } from '../SignatureConfirmComponents/ShimmerSignGuard';

import TransactionPreview from './TransactionPreview';
import {
  getParserAlertDisplay,
  hasAddressRiskTags,
  shouldShowNoIssueSection,
} from './utils';

type ISecurityCheckKind = 'transaction' | 'message';

type ISecurityCheckCategory = 'site' | 'operation';

type ISecurityCheckStatus = 'critical' | 'warning' | 'unknown' | 'info';

type ISecurityCheckFinding = {
  id: string;
  category: ISecurityCheckCategory;
  status: ISecurityCheckStatus;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
};

type IProps = {
  kind: ISecurityCheckKind;
  requestKey?: string;
  requestIdentity?: object;
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  simulationComponents?: IDisplayComponentSimulation[];
  messageDisplay?: ISignatureConfirmDisplay;
  unsignedMessage?: IUnsignedMessage;
  isRiskSignMethod?: boolean;
  isConfirmationRequired?: boolean;
  isMessageParseFallback?: boolean;
};

const CATEGORY_ORDER: ISecurityCheckCategory[] = ['site', 'operation'];

const STATUS_WEIGHT: Record<ISecurityCheckStatus, number> = {
  critical: 5,
  warning: 4,
  unknown: 3,
  info: 1,
};

const STATUS_LABEL_ID: Record<ISecurityCheckStatus, ETranslations> = {
  critical: ETranslations.global_risk,
  warning: ETranslations.global_warning,
  unknown: ETranslations.global_unverified,
  info: ETranslations.global_info,
};

const SECURITY_CHECK_ACCORDION_VALUE = 'security-check';

const SITE_RISK_FINDING_CONFIG: Partial<
  Record<
    EHostSecurityLevel,
    {
      id: string;
      status: ISecurityCheckStatus;
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

function shouldExpandByDefault(findings: ISecurityCheckFinding[]) {
  return findings.some(
    (finding) =>
      finding.status === 'critical' ||
      finding.status === 'warning' ||
      (finding.status === 'unknown' && finding.category !== 'site'),
  );
}

function getDefaultAccordionValue(findings: ISecurityCheckFinding[]) {
  return shouldExpandByDefault(findings)
    ? [SECURITY_CHECK_ACCORDION_VALUE]
    : [];
}

function isAccordionValueEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function getFindingStyle(status: ISecurityCheckStatus): {
  icon: IKeyOfIcons;
  iconColor: IIconProps['color'];
  badgeType: IBadgeType;
} {
  if (status === 'critical') {
    return {
      icon: 'ErrorSolid',
      iconColor: '$iconCritical',
      badgeType: 'critical',
    };
  }
  if (status === 'warning') {
    return {
      icon: 'InfoSquareSolid',
      iconColor: '$iconCaution',
      badgeType: 'warning',
    };
  }
  // 'unknown' and any other status fall through to the neutral info style.
  return {
    icon: 'InfoCircleOutline',
    iconColor: '$iconInfo',
    badgeType: 'info',
  };
}

function getSiteFinding({
  origin,
  urlSecurityInfo,
  intl,
}: {
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  intl: ReturnType<typeof useIntl>;
}): ISecurityCheckFinding | undefined {
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
        intl.formatMessage({
          id: riskFindingConfig.titleId,
        }),
      action: urlSecurityInfo.detail
        ? {
            label: intl.formatMessage({ id: ETranslations.global_details }),
            onPress: () => {
              showDAppRiskyAlertDetail({ origin, urlSecurityInfo });
            },
          }
        : undefined,
    };
  }

  if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
    return undefined;
  }

  return {
    id: 'site-unknown',
    category: 'site',
    status: 'unknown',
    title: intl.formatMessage({ id: ETranslations.global_unverified }),
  };
}

function getDisplayComponents({
  decodedTxs,
  messageDisplay,
}: {
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
}) {
  const txComponents =
    decodedTxs?.flatMap((decodedTx) => decodedTx.txDisplay?.components ?? []) ??
    [];
  return txComponents.concat(messageDisplay?.components ?? []);
}

function getCoverageTitle({
  kind,
  origin,
  urlSecurityInfo,
  decodedTxs,
  messageDisplay,
  intl,
}: {
  kind: ISecurityCheckKind;
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  intl: ReturnType<typeof useIntl>;
}) {
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

function getCustomHexFindings({
  decodedTxs,
  intl,
}: {
  decodedTxs?: IDecodedTx[];
  intl: ReturnType<typeof useIntl>;
}): ISecurityCheckFinding[] {
  const findings: ISecurityCheckFinding[] = [];
  const seenTitleIds = new Set<ETranslations>();
  decodedTxs
    ?.filter((decodedTx) => decodedTx.isCustomHexData)
    .forEach((decodedTx) => {
      getCustomHexDataAlertTitleIds(decodedTx).forEach((titleId) => {
        // These are generic operation warnings, not tx-specific — collapse the
        // same warning across a batch of custom-hex txs into a single row.
        if (seenTitleIds.has(titleId)) {
          return;
        }
        seenTitleIds.add(titleId);
        findings.push({
          id: `custom-hex-${titleId}`,
          category: 'operation' as const,
          status: 'warning' as const,
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
  isConfirmationRequired,
  isMessageParseFallback,
  intl,
}: {
  kind: ISecurityCheckKind;
  origin?: string;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  unsignedMessage?: IUnsignedMessage;
  isRiskSignMethod?: boolean;
  isConfirmationRequired?: boolean;
  isMessageParseFallback?: boolean;
  intl: ReturnType<typeof useIntl>;
}): ISecurityCheckFinding[] {
  const findings: ISecurityCheckFinding[] = [];

  const parserAlerts =
    kind === 'transaction'
      ? (decodedTxs?.flatMap(
          (decodedTx) => decodedTx.txDisplay?.alerts ?? [],
        ) ?? [])
      : (messageDisplay?.alerts ?? []);
  const validParserAlerts = dedupeAlertTexts(parserAlerts.filter(Boolean));
  const localMessageFindings: ISecurityCheckFinding[] = [];

  if (kind === 'message' && unsignedMessage) {
    const isTypedData =
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
      unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;
    const isPermitSignMethod = isPrimaryTypePermitSign({ unsignedMessage });
    const isOrderSignMethod = isPrimaryTypeOrderSign({ unsignedMessage });

    if (isTypedData) {
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

  // Locally-derived operation findings that a server parser alert may restate;
  // used to drop duplicate parser alerts, and appended to `findings` below.
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

  if (kind === 'message' && isConfirmationRequired) {
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

  // Locally parsed txs carry no server-side analysis (alerts are hard-coded
  // empty), so surface an explicit "Unverified" row instead of silently
  // rendering nothing. Scoped to dApp requests (`origin`): wallet-built flows
  // (batch swaps, custom networks) always local-parse by design and never
  // showed a security verdict, so an unverified row there would be pure noise.
  // Exception: `hasServerSecurityAnalysis` (scaled-UI forced-local path) —
  // the server parse DID run and its alerts were retained, so it is not
  // actually unverified.
  if (
    kind === 'transaction' &&
    origin &&
    decodedTxs?.some(
      (decodedTx) =>
        decodedTx.isLocalParsed && !decodedTx.hasServerSecurityAnalysis,
    )
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
    const key = finding.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sortFindingsByStatus(findings: ISecurityCheckFinding[]) {
  return [...findings].toSorted(
    (a, b) => STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status],
  );
}

function getHighestStatusWeight(findings: ISecurityCheckFinding[]) {
  return findings.reduce(
    (weight, finding) => Math.max(weight, STATUS_WEIGHT[finding.status]),
    0,
  );
}

function getCategoryLabel({
  category,
  kind,
  intl,
}: {
  category: ISecurityCheckCategory;
  kind: ISecurityCheckKind;
  intl: ReturnType<typeof useIntl>;
}) {
  if (category === 'site') {
    return intl.formatMessage({ id: ETranslations.global_website });
  }
  return intl.formatMessage({
    id:
      kind === 'message'
        ? ETranslations.dapp_connect_signature_analysis__title
        : ETranslations.dapp_connect_transaction_analysis__title,
  });
}

function getCategorySourceLabel({
  category,
  kind,
  intl,
}: {
  category: ISecurityCheckCategory;
  kind: ISecurityCheckKind;
  intl: ReturnType<typeof useIntl>;
}) {
  let id = ETranslations.dapp_connect_transaction_analysis__title;
  if (category === 'site') {
    id = ETranslations.dapp_connect_site_security__title;
  } else if (kind === 'message') {
    id = ETranslations.dapp_connect_signature_analysis__title;
  }
  return intl.formatMessage({ id });
}

function SecurityCheckFindingRow({
  finding,
}: {
  finding: ISecurityCheckFinding;
}) {
  const style = getFindingStyle(finding.status);
  return (
    <XStack gap="$2.5" alignItems="flex-start">
      <YStack
        w="$5"
        h="$5"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon name={style.icon} size="$5" color={style.iconColor} />
      </YStack>
      <YStack gap="$1" flex={1} minWidth={0}>
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <SizableText size="$bodyMdMedium" flexShrink={1}>
            {finding.title}
          </SizableText>
        </XStack>
        {finding.description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {finding.description}
          </SizableText>
        ) : null}
        {finding.action ? (
          <Button
            testID={`${SignatureConfirmTestIDs.SecurityCheckCard}-details`}
            size="small"
            variant="tertiary"
            alignSelf="flex-start"
            onPress={finding.action.onPress}
          >
            {finding.action.label}
          </Button>
        ) : null}
      </YStack>
    </XStack>
  );
}

function SecurityCheckCategoryGroup({
  category,
  kind,
  findings,
  intl,
}: {
  category: ISecurityCheckCategory;
  kind: ISecurityCheckKind;
  findings: ISecurityCheckFinding[];
  intl: ReturnType<typeof useIntl>;
}) {
  if (!findings.length) {
    return null;
  }
  return (
    <YStack gap="$2.5">
      <SizableText size="$bodySmMedium" color="$textSubdued">
        {getCategoryLabel({ category, kind, intl })}
      </SizableText>
      <YStack gap="$3">
        {findings.map((finding) => (
          <SecurityCheckFindingRow key={finding.id} finding={finding} />
        ))}
      </YStack>
    </YStack>
  );
}

function SecurityCheckCard(props: IProps) {
  const {
    kind,
    requestKey,
    requestIdentity,
    origin,
    urlSecurityInfo,
    decodedTxs,
    simulationComponents,
    messageDisplay,
    unsignedMessage,
    isRiskSignMethod,
    isConfirmationRequired,
    isMessageParseFallback,
  } = props;
  const intl = useIntl();

  const hasAddressRisk = useMemo(
    () =>
      hasAddressRiskTags(
        getDisplayComponents({
          decodedTxs,
          messageDisplay,
        }),
      ),
    [decodedTxs, messageDisplay],
  );

  const findings = useMemo(
    () =>
      dedupeFindings([
        ...[
          getSiteFinding({
            origin,
            urlSecurityInfo,
            intl,
          }),
        ].filter(Boolean),
        ...getOperationFindings({
          kind,
          origin,
          decodedTxs,
          messageDisplay,
          unsignedMessage,
          isRiskSignMethod,
          isConfirmationRequired,
          isMessageParseFallback,
          intl,
        }),
      ] as ISecurityCheckFinding[]),
    [
      decodedTxs,
      intl,
      isConfirmationRequired,
      isMessageParseFallback,
      isRiskSignMethod,
      kind,
      messageDisplay,
      origin,
      unsignedMessage,
      urlSecurityInfo,
    ],
  );

  const hasResolvedRequiredChecks = useMemo(() => {
    if (!origin) {
      return false;
    }
    const siteResolved = Boolean(urlSecurityInfo?.level);
    // A locally parsed tx only proves the local decoder ran — the server-side
    // security analysis (parser alerts, address risk) never happened, so it
    // must not count as a resolved check (would show a false "No issues").
    // Exception: `hasServerSecurityAnalysis` (scaled-UI forced-local path) —
    // the server parse DID run, so that tx counts as resolved.
    const operationResolved =
      kind === 'transaction'
        ? Boolean(decodedTxs?.length) &&
          !decodedTxs?.some(
            (decodedTx) =>
              decodedTx.isLocalParsed && !decodedTx.hasServerSecurityAnalysis,
          )
        : Boolean(messageDisplay) && !isMessageParseFallback;
    return siteResolved && operationResolved;
  }, [
    decodedTxs,
    isMessageParseFallback,
    kind,
    messageDisplay,
    origin,
    urlSecurityInfo?.level,
  ]);

  const highestStatus = useMemo(() => {
    if (!findings.length) {
      return undefined;
    }
    return findings.reduce<ISecurityCheckStatus>(
      (status, finding) =>
        STATUS_WEIGHT[finding.status] > STATUS_WEIGHT[status]
          ? finding.status
          : status,
      'info',
    );
  }, [findings]);

  const [accordionValue, setAccordionValue] = useState<string[]>(() =>
    getDefaultAccordionValue(findings),
  );
  // Keep the render key compact while tracking transaction revisions by
  // reference. Some cross-chain encoded payloads are too large to stringify
  // synchronously just to detect an updated review request.
  const effectiveRequestIdentity = requestIdentity ?? requestKey;
  const hasUserChangedAccordionRef = useRef(false);
  const previousRequestIdentityRef = useRef(effectiveRequestIdentity);
  const previousHighestStatusWeightRef = useRef(0);

  useLayoutEffect(() => {
    const highestStatusWeight = highestStatus
      ? STATUS_WEIGHT[highestStatus]
      : 0;
    const didRequestChange = !Object.is(
      previousRequestIdentityRef.current,
      effectiveRequestIdentity,
    );
    if (didRequestChange) {
      previousRequestIdentityRef.current = effectiveRequestIdentity;
      hasUserChangedAccordionRef.current = false;
      previousHighestStatusWeightRef.current = 0;
    }

    const didRiskUpgrade =
      highestStatusWeight > previousHighestStatusWeightRef.current;

    if (
      didRequestChange ||
      !hasUserChangedAccordionRef.current ||
      didRiskUpgrade
    ) {
      const nextValue = getDefaultAccordionValue(findings);
      setAccordionValue((currentValue) =>
        isAccordionValueEqual(currentValue, nextValue)
          ? currentValue
          : nextValue,
      );
    }

    // Track the high-water mark so a transient dip-and-recover of the same
    // finding (e.g. a re-decode momentarily clearing findings) doesn't read as
    // a risk upgrade and re-open a card the user deliberately collapsed.
    previousHighestStatusWeightRef.current = Math.max(
      previousHighestStatusWeightRef.current,
      highestStatusWeight,
    );
  }, [effectiveRequestIdentity, findings, highestStatus]);

  const handleAccordionValueChange = useCallback((value: string[]) => {
    hasUserChangedAccordionRef.current = true;
    setAccordionValue(value);
  }, []);

  const groupedFindings = useMemo(
    () => ({
      site: sortFindingsByStatus(
        findings.filter((finding) => finding.category === 'site'),
      ),
      operation: sortFindingsByStatus(
        findings.filter((finding) => finding.category === 'operation'),
      ),
    }),
    [findings],
  );

  const orderedCategories = useMemo(
    () =>
      CATEGORY_ORDER.filter(
        (category) => groupedFindings[category].length > 0,
      ).toSorted((a, b) => {
        const weightDiff =
          getHighestStatusWeight(groupedFindings[b]) -
          getHighestStatusWeight(groupedFindings[a]);
        if (weightDiff !== 0) {
          return weightDiff;
        }
        return CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b);
      }),
    [groupedFindings],
  );

  const coverageTitle = useMemo(
    () =>
      getCoverageTitle({
        kind,
        origin,
        urlSecurityInfo,
        decodedTxs,
        messageDisplay,
        intl,
      }),
    [decodedTxs, intl, kind, messageDisplay, origin, urlSecurityInfo],
  );

  const highestStatusSourceTitle = useMemo(() => {
    if (!highestStatus) {
      return '';
    }
    // Risk-state subtitles name only the categories contributing to the
    // visible badge. The success state keeps the full resolved coverage.
    return CATEGORY_ORDER.filter((category) =>
      findings.some(
        (finding) =>
          finding.category === category && finding.status === highestStatus,
      ),
    )
      .map((category) => getCategorySourceLabel({ category, kind, intl }))
      .join(' · ');
  }, [findings, highestStatus, intl, kind]);

  const hasNoCardFindings = findings.length === 0;

  const renderSummary = useCallback(() => {
    if (!highestStatus) {
      return null;
    }
    const style = getFindingStyle(highestStatus);
    const title = intl.formatMessage({
      id: STATUS_LABEL_ID[highestStatus],
    });
    return (
      <XStack gap="$2" alignItems="center" flexShrink={0}>
        <Badge badgeType={style.badgeType} badgeSize="sm">
          {title}
        </Badge>
      </XStack>
    );
  }, [highestStatus, intl]);

  const hasAssets = (simulationComponents ?? []).some(
    (component) => component.assets.length > 0,
  );

  const headerTitle = intl.formatMessage({
    id: ETranslations.dapp_connect_security_checks__title,
  });

  const findingsSection = !hasNoCardFindings ? (
    <Accordion
      type="multiple"
      collapsable
      value={accordionValue}
      onValueChange={handleAccordionValueChange}
      bg="$transparent"
    >
      <Accordion.Item value={SECURITY_CHECK_ACCORDION_VALUE} bg="$transparent">
        <Accordion.Trigger
          unstyled
          flexDirection="row"
          alignItems="center"
          justifyContent="flex-start"
          gap="$3"
          px="$3"
          py="$2.5"
          borderWidth={0}
          bg="$transparent"
          hoverStyle={{
            bg: '$neutral3',
          }}
          pressStyle={{
            bg: '$neutral3',
          }}
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: -2,
          }}
        >
          {({ open }: { open: boolean }) => (
            <XStack flex={1} minWidth={0} alignItems="center" gap="$2">
              <YStack flex={1} minWidth={0} gap="$0.5">
                <SizableText
                  size="$bodyMdMedium"
                  numberOfLines={2}
                  textAlign="left"
                >
                  {headerTitle}
                </SizableText>
                {highestStatusSourceTitle ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={2}
                    textAlign="left"
                  >
                    {highestStatusSourceTitle}
                  </SizableText>
                ) : null}
              </YStack>
              <XStack alignItems="center" gap="$2" flexShrink={0}>
                {renderSummary()}
                <YStack flexShrink={0} rotate={open ? '180deg' : '0deg'}>
                  <Icon
                    name="ChevronDownSmallOutline"
                    color="$iconSubdued"
                    size="$5"
                  />
                </YStack>
              </XStack>
            </XStack>
          )}
        </Accordion.Trigger>
        <Accordion.Content unstyled px="$3" pb="$3" pt="$0" bg="$transparent">
          <YStack gap="$3.5" pt="$3">
            {orderedCategories.map((category) => (
              <SecurityCheckCategoryGroup
                key={category}
                category={category}
                kind={kind}
                findings={groupedFindings[category]}
                intl={intl}
              />
            ))}
          </YStack>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  ) : null;

  // Address risk stays next to the relevant address instead of becoming a card
  // finding. Suppress the global success row when such a tag exists so the
  // card cannot claim "No issues" above a risky address.
  const shouldShowNoIssue = shouldShowNoIssueSection({
    hasCardFindings: !hasNoCardFindings,
    hasAddressRisk,
    hasResolvedRequiredChecks,
    hasCoverageTitle: Boolean(coverageTitle),
  });
  const noIssueSection = shouldShowNoIssue ? (
    <XStack alignItems="center" gap="$2" px="$3" py="$2.5">
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText size="$bodyMdMedium" numberOfLines={2}>
          {headerTitle}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={2}>
          {coverageTitle}
        </SizableText>
      </YStack>
      <Badge badgeType="success" badgeSize="sm" flexShrink={0}>
        {intl.formatMessage({
          id: ETranslations.dapp_connect_security_checks_no_issues_detected__text,
        })}
      </Badge>
    </XStack>
  ) : null;

  const securitySection = findingsSection ?? noIssueSection;
  const showSignGuardFooter =
    hasNoCardFindings ||
    accordionValue.includes(SECURITY_CHECK_ACCORDION_VALUE);

  if (!hasAssets && !securitySection) {
    return null;
  }

  // The glow identifies a visible transaction simulation, not a safety
  // verdict; finding styles and the summary badge carry the risk signal.
  return (
    <LaserBorder
      key={requestKey}
      borderRadius={12}
      glow={hasAssets}
      borderColor="$neutral4"
    >
      <YStack testID={SignatureConfirmTestIDs.SecurityCheckCard}>
        {securitySection}
        {hasAssets ? (
          <YStack
            mx="$3"
            py="$3"
            gap="$2"
            borderTopWidth={
              securitySection ? StyleSheet.hairlineWidth : undefined
            }
            borderTopColor={securitySection ? '$neutral4' : undefined}
          >
            <TransactionPreview
              bare
              simulationComponents={simulationComponents}
            />
          </YStack>
        ) : null}
        {/* SignGuard signs the whole report from a fixed footer slot so the
            header rows stay free for the title and the risk summary badge.
            No divider on purpose: a full-width hairline over a lone mark reads
            as an empty compartment — the powered-by prefix gives it context. */}
        {showSignGuardFooter ? (
          <XStack
            justifyContent="flex-end"
            alignItems="center"
            gap="$1.5"
            px="$3"
            pb="$2.5"
          >
            <SizableText size="$bodySmMedium" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_power_by })}
            </SizableText>
            <ShimmerSignGuard />
          </XStack>
        ) : null}
      </YStack>
    </LaserBorder>
  );
}

export default memo(SecurityCheckCard);
