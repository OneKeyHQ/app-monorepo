import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EHostSecurityLevel,
  type IHostSecurity,
} from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EParseTxComponentType,
  type IDisplayComponent,
  type IDisplayComponentAddress,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { showDAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout';
import { SignatureConfirmTestIDs } from '../../testIDs';
import { getCustomHexDataAlertTitleIds } from '../CustomHexDataAlert/utils';

type ISecurityCheckKind = 'transaction' | 'message';

type ISecurityCheckCategory = 'site' | 'operation' | 'address';

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
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  unsignedMessage?: IUnsignedMessage;
  isRiskSignMethod?: boolean;
  isConfirmationRequired?: boolean;
  isMessageParseFallback?: boolean;
};

const CATEGORY_ORDER: ISecurityCheckCategory[] = [
  'site',
  'operation',
  'address',
];

const STATUS_WEIGHT: Record<ISecurityCheckStatus, number> = {
  critical: 5,
  warning: 4,
  unknown: 3,
  info: 1,
};

const SECURITY_CHECK_ACCORDION_VALUE = 'security-check';

const RISK_BADGE_TYPES = new Set<IBadgeType>(['warning', 'critical']);

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

const TX_CONFIRMATION_REQUIRED_DESCRIPTION =
  'Transaction analysis flagged this request for extra review.';
const MESSAGE_CONFIRMATION_REQUIRED_DESCRIPTION =
  'Signature analysis flagged this request for extra review.';
const TYPED_DATA_SIGNATURE_DESCRIPTION =
  'Review the structured data carefully before signing.';
const MESSAGE_PARSE_FALLBACK_DESCRIPTION =
  'Only basic message details are available. Review the raw data carefully before signing.';

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
  if (status === 'unknown') {
    return {
      icon: 'InfoCircleOutline',
      iconColor: '$iconInfo',
      badgeType: 'info',
    };
  }
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

function getAddressRiskKey({
  component,
  riskTags,
}: {
  component: IDisplayComponentAddress;
  riskTags: IDisplayComponentAddress['tags'];
}) {
  const tagKey = riskTags
    .map(
      (tag) =>
        `${tag.key ?? ''}:${tag.value}:${tag.displayType}:${tag.icon ?? ''}:${
          tag.iconURL ?? ''
        }`,
    )
    .join(',');
  return [
    component.address,
    component.label,
    component.role ?? '',
    component.networkId ?? '',
    tagKey,
  ].join('|');
}

function getCoverageTitle({
  kind,
  origin,
  urlSecurityInfo,
  decodedTxs,
  messageDisplay,
  hasAddressRiskFindings,
  intl,
}: {
  kind: ISecurityCheckKind;
  origin?: string;
  urlSecurityInfo?: IHostSecurity;
  decodedTxs?: IDecodedTx[];
  messageDisplay?: ISignatureConfirmDisplay;
  hasAddressRiskFindings?: boolean;
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
  if (hasAddressRiskFindings) {
    labels.push(intl.formatMessage({ id: ETranslations.global_address }));
  }
  return labels.join(' · ');
}

function getAddressFindings(
  components: IDisplayComponent[],
  intl: ReturnType<typeof useIntl>,
): ISecurityCheckFinding[] {
  const riskAddressComponents = components
    .filter(
      (component): component is IDisplayComponentAddress =>
        component.type === EParseTxComponentType.Address,
    )
    .map((component) => {
      const riskTags = component.tags.filter((tag) =>
        RISK_BADGE_TYPES.has(tag.displayType),
      );
      return {
        component,
        riskTags,
        status: riskTags.some((tag) => tag.displayType === 'critical')
          ? ('critical' as const)
          : ('warning' as const),
      };
    })
    .filter(({ riskTags }) => riskTags.length > 0);
  const seenAddressRiskKeys = new Set<string>();
  const uniqueRiskAddressComponents = riskAddressComponents.filter(
    ({ component, riskTags }) => {
      const key = getAddressRiskKey({ component, riskTags });
      if (seenAddressRiskKeys.has(key)) {
        return false;
      }
      seenAddressRiskKeys.add(key);
      return true;
    },
  );

  if (!uniqueRiskAddressComponents.length) {
    return [];
  }

  return [...uniqueRiskAddressComponents]
    .toSorted((a, b) => STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status])
    .map(({ component, riskTags, status }) => {
      const riskTagValues = [
        ...new Set(riskTags.map((tag) => tag.value).filter(Boolean)),
      ];
      let riskTagSummary = riskTagValues.slice(0, 2).join(', ');
      if (!riskTagSummary) {
        riskTagSummary =
          status === 'critical'
            ? intl.formatMessage({ id: ETranslations.global_risk })
            : intl.formatMessage({ id: ETranslations.global_warning });
      }
      return {
        id: `address-summary-${getAddressRiskKey({ component, riskTags })}`,
        category: 'address',
        status,
        title: `${
          component.label ||
          intl.formatMessage({ id: ETranslations.global_address })
        }: ${accountUtils.shortenAddress({ address: component.address })}`,
        description: riskTagSummary,
      };
    });
}

function getCustomHexFindings({
  decodedTxs,
  intl,
}: {
  decodedTxs?: IDecodedTx[];
  intl: ReturnType<typeof useIntl>;
}): ISecurityCheckFinding[] {
  const findings: ISecurityCheckFinding[] = [];
  decodedTxs
    ?.filter((decodedTx) => decodedTx.isCustomHexData)
    .forEach((decodedTx, index) => {
      const titleIds = getCustomHexDataAlertTitleIds(decodedTx);
      findings.push(
        ...titleIds.map((titleId) => ({
          id: `custom-hex-${index}-${titleId}`,
          category: 'operation' as const,
          status: 'warning' as const,
          title: intl.formatMessage({ id: titleId }),
        })),
      );
    });
  return findings;
}

function getParserAlertDisplay(alert: string) {
  const normalizedAlert = alert.trim();
  if (normalizedAlert.length <= 80) {
    return { title: normalizedAlert };
  }

  const sentenceEndIndex = normalizedAlert.search(/[.!?。！？]/);
  const firstSentence =
    sentenceEndIndex > 0 ? normalizedAlert.slice(0, sentenceEndIndex + 1) : '';

  if (firstSentence && firstSentence.length <= 100) {
    const description = normalizedAlert.slice(firstSentence.length).trim();
    return {
      title: firstSentence,
      description: description || undefined,
    };
  }

  return {
    title: `${normalizedAlert.slice(0, 80).trim()}...`,
    description: normalizedAlert,
  };
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
  decodedTxs,
  messageDisplay,
  unsignedMessage,
  isRiskSignMethod,
  isConfirmationRequired,
  isMessageParseFallback,
  intl,
}: {
  kind: ISecurityCheckKind;
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
          title: 'Permit signature request',
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_permit_sign_alert,
          }),
        });
      } else if (isOrderSignMethod) {
        localMessageFindings.push({
          id: 'message-order',
          category: 'operation',
          status: 'warning',
          title: 'Order signature request',
          description: intl.formatMessage({
            id: ETranslations.dapp_connect_order_alert,
          }),
        });
      } else {
        localMessageFindings.push({
          id: 'message-typed-data',
          category: 'operation',
          status: isRiskSignMethod ? 'warning' : 'info',
          title: 'Typed data signature request',
          description: TYPED_DATA_SIGNATURE_DESCRIPTION,
        });
      }
    }

    if (isRiskSignMethod && !isTypedData) {
      localMessageFindings.push({
        id: 'message-risk-sign-method',
        category: 'operation',
        status: 'critical',
        title: intl.formatMessage({
          id: ETranslations.dapp_connect_risk_sign,
        }),
      });
    }
  }

  validParserAlerts
    .filter(
      (alert) =>
        !localMessageFindings.some((finding) =>
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
      title: 'Risk review required',
      description: TX_CONFIRMATION_REQUIRED_DESCRIPTION,
    });
  }

  if (kind === 'message' && isConfirmationRequired) {
    findings.push({
      id: 'message-confirmation-required',
      category: 'operation',
      status: 'warning',
      title: 'Risk review required',
      description: MESSAGE_CONFIRMATION_REQUIRED_DESCRIPTION,
    });
  }

  findings.push(...localMessageFindings);

  if (kind === 'message' && isMessageParseFallback) {
    findings.push({
      id: 'message-parse-fallback',
      category: 'operation',
      status: 'unknown',
      title: 'Review raw message data',
      description: MESSAGE_PARSE_FALLBACK_DESCRIPTION,
    });
  }

  findings.push(...getCustomHexFindings({ decodedTxs, intl }));

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
  if (category === 'operation') {
    return intl.formatMessage({
      id:
        kind === 'message'
          ? ETranslations.dapp_connect_signature_analysis__title
          : ETranslations.dapp_connect_transaction_analysis__title,
    });
  }
  return intl.formatMessage({ id: ETranslations.global_address });
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
    origin,
    urlSecurityInfo,
    decodedTxs,
    messageDisplay,
    unsignedMessage,
    isRiskSignMethod,
    isConfirmationRequired,
    isMessageParseFallback,
  } = props;
  const intl = useIntl();

  const findings = useMemo(() => {
    const displayComponents = getDisplayComponents({
      decodedTxs,
      messageDisplay,
    });
    return dedupeFindings([
      ...[
        getSiteFinding({
          origin,
          urlSecurityInfo,
          intl,
        }),
      ].filter(Boolean),
      ...getOperationFindings({
        kind,
        decodedTxs,
        messageDisplay,
        unsignedMessage,
        isRiskSignMethod,
        isConfirmationRequired,
        isMessageParseFallback,
        intl,
      }),
      ...getAddressFindings(displayComponents, intl),
    ] as ISecurityCheckFinding[]);
  }, [
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
  const hasUserChangedAccordionRef = useRef(false);
  const previousRequestKeyRef = useRef(requestKey);
  const previousHighestStatusWeightRef = useRef(0);

  useEffect(() => {
    const highestStatusWeight = highestStatus
      ? STATUS_WEIGHT[highestStatus]
      : 0;
    const didRequestChange = previousRequestKeyRef.current !== requestKey;
    if (didRequestChange) {
      previousRequestKeyRef.current = requestKey;
      hasUserChangedAccordionRef.current = false;
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

    previousHighestStatusWeightRef.current = highestStatusWeight;
  }, [findings, highestStatus, requestKey]);

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
      address: sortFindingsByStatus(
        findings.filter((finding) => finding.category === 'address'),
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
        hasAddressRiskFindings: findings.some(
          (finding) => finding.category === 'address',
        ),
        intl,
      }),
    [decodedTxs, findings, intl, kind, messageDisplay, origin, urlSecurityInfo],
  );

  const renderSummary = useCallback(() => {
    if (!highestStatus) {
      return null;
    }
    const style = getFindingStyle(highestStatus);
    const criticalCount = findings.filter(
      (finding) => finding.status === 'critical',
    ).length;
    const warningCount = findings.filter(
      (finding) => finding.status === 'warning',
    ).length;
    const unknownCount = findings.filter(
      (finding) => finding.status === 'unknown',
    ).length;
    let title = '';
    if (criticalCount > 0) {
      title = `${criticalCount + warningCount} ${intl.formatMessage({
        id: ETranslations.global_risk,
      })}`;
    } else if (warningCount > 0) {
      title = `${warningCount} ${intl.formatMessage({
        id: ETranslations.global_warning,
      })}`;
    } else if (unknownCount > 0) {
      title = `${unknownCount} ${intl.formatMessage({
        id: ETranslations.global_unverified,
      })}`;
    }
    return (
      <XStack gap="$2" alignItems="center" flexShrink={0}>
        {title ? (
          <Badge badgeType={style.badgeType} badgeSize="sm">
            {title}
          </Badge>
        ) : null}
      </XStack>
    );
  }, [findings, highestStatus, intl]);

  if (!findings.length) {
    return null;
  }

  const headerTitle = intl.formatMessage({
    id: ETranslations.dapp_connect_security_checks__title,
  });

  return (
    <YStack
      testID={SignatureConfirmTestIDs.SecurityCheckCard}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      borderRadius="$3"
      overflow="hidden"
      bg="$bgSubdued"
    >
      <Accordion
        type="multiple"
        collapsable
        value={accordionValue}
        onValueChange={handleAccordionValueChange}
        bg="$transparent"
      >
        <Accordion.Item
          value={SECURITY_CHECK_ACCORDION_VALUE}
          bg="$transparent"
        >
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
              <>
                <YStack flex={1} minWidth={0} alignItems="flex-start">
                  <SizableText
                    size="$bodyMdMedium"
                    numberOfLines={1}
                    textAlign="left"
                  >
                    {headerTitle}
                  </SizableText>
                  {coverageTitle ? (
                    <SizableText
                      size="$bodySm"
                      color="$textSubdued"
                      numberOfLines={1}
                      textAlign="left"
                    >
                      {coverageTitle}
                    </SizableText>
                  ) : null}
                </YStack>
                <XStack
                  gap="$2"
                  alignItems="center"
                  justifyContent="flex-end"
                  flexShrink={0}
                >
                  {renderSummary()}
                  <YStack rotate={open ? '180deg' : '0deg'}>
                    <Icon
                      name="ChevronDownSmallOutline"
                      color="$iconSubdued"
                      size="$5"
                    />
                  </YStack>
                </XStack>
              </>
            )}
          </Accordion.Trigger>
          <Accordion.HeightAnimator>
            <Accordion.Content
              unstyled
              px="$3"
              pb="$3"
              pt="$0"
              bg="$transparent"
            >
              <YStack
                gap="$3.5"
                pt="$3"
                borderTopWidth={StyleSheet.hairlineWidth}
                borderTopColor="$neutral3"
              >
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
          </Accordion.HeightAnimator>
        </Accordion.Item>
      </Accordion>
    </YStack>
  );
}

export default memo(SecurityCheckCard);
