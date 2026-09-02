import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Accordion,
  Badge,
  Button,
  Icon,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDisplayComponentSimulation } from '@onekeyhq/shared/types/signatureConfirm';

import { showDAppRiskyAlertDetail } from '../../../DAppConnection/components/DAppRequestLayout';
import { SignatureConfirmTestIDs } from '../../testIDs';
import { LaserBorder } from '../SignatureConfirmComponents/LaserBorder';
import { ShimmerSignGuard } from '../SignatureConfirmComponents/ShimmerSignGuard';

import { SECURITY_CHECK_STATUS_WEIGHT } from './securityCheckModel';
import TransactionPreview from './TransactionPreview';
import { showTransactionSecurityDetails } from './TransactionSecurityDetails';

import type {
  ISecurityCheckCategory,
  ISecurityCheckFinding,
  ISecurityCheckStatus,
  ISecurityCheckViewModel,
} from './securityCheckModel';

type IProps = {
  requestKey?: string;
  requestIdentity?: object;
  simulationComponents?: IDisplayComponentSimulation[];
  model: ISecurityCheckViewModel;
};

const STATUS_LABEL_ID: Record<ISecurityCheckStatus, ETranslations> = {
  critical: ETranslations.global_risk,
  warning:
    ETranslations.dapp_connect_security_checks_risk_review_required__title,
  unknown: ETranslations.global_unverified,
  info: ETranslations.global_info,
  success: ETranslations.dapp_connect_security_checks_no_issues_detected__text,
  loading: ETranslations.global_checking,
};

const SECURITY_CHECK_ACCORDION_VALUE = 'security-check';

function getDefaultAccordionValue(defaultExpanded: boolean) {
  return defaultExpanded ? [SECURITY_CHECK_ACCORDION_VALUE] : [];
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
      icon: 'InfoSquareOutline',
      iconColor: '$iconCaution',
      badgeType: 'warning',
    };
  }
  if (status === 'unknown') {
    return {
      icon: 'QuestionmarkOutline',
      iconColor: '$iconSubdued',
      badgeType: 'default',
    };
  }
  if (status === 'success') {
    return {
      icon: 'CheckRadioOutline',
      iconColor: '$iconSuccess',
      badgeType: 'success',
    };
  }
  return {
    icon: 'InfoCircleOutline',
    iconColor: '$iconInfo',
    badgeType: 'info',
  };
}

function SecurityCheckFindingRow({
  finding,
}: {
  finding: ISecurityCheckFinding;
}) {
  const intl = useIntl();
  const style = getFindingStyle(finding.status);
  const handleDetails = useCallback(() => {
    if (finding.action?.type === 'site') {
      showDAppRiskyAlertDetail({
        origin: finding.action.origin,
        urlSecurityInfo: finding.action.urlSecurityInfo,
      });
      return;
    }
    if (finding.action?.type === 'transactionSecurity') {
      showTransactionSecurityDetails({
        result: finding.action.result,
        title: intl.formatMessage({ id: ETranslations.global_details }),
      });
    }
  }, [finding.action, intl]);

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
        <XStack gap="$2" alignItems="flex-start" justifyContent="space-between">
          <SizableText size="$bodyMdMedium" flex={1} flexShrink={1}>
            {finding.title}
          </SizableText>
          {finding.action ? (
            <Button
              testID={`${SignatureConfirmTestIDs.SecurityCheckCard}-details`}
              size="small"
              variant="tertiary"
              flexShrink={0}
              onPress={handleDetails}
            >
              {intl.formatMessage({ id: ETranslations.global_details })}
            </Button>
          ) : null}
        </XStack>
        {finding.description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {finding.description}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

function SecurityCheckCategoryGroup({
  category,
  model,
  showLabel,
}: {
  category: ISecurityCheckCategory;
  model: ISecurityCheckViewModel;
  showLabel: boolean;
}) {
  const intl = useIntl();
  const findings = model.groupedFindings[category];
  if (!findings.length) {
    return null;
  }
  const label =
    category === 'site'
      ? intl.formatMessage({ id: ETranslations.global_website })
      : intl.formatMessage({
          id:
            model.kind === 'message'
              ? ETranslations.dapp_connect_signature_analysis__title
              : ETranslations.dapp_connect_transaction_analysis__title,
        });

  return (
    <YStack gap="$2.5">
      {showLabel ? (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {label}
        </SizableText>
      ) : null}
      <YStack gap="$3">
        {findings.map((finding) => (
          <SecurityCheckFindingRow key={finding.id} finding={finding} />
        ))}
      </YStack>
    </YStack>
  );
}

function SecurityCheckCard({
  requestKey,
  requestIdentity,
  simulationComponents,
  model,
}: IProps) {
  const intl = useIntl();
  const [accordionValue, setAccordionValue] = useState<string[]>(() =>
    getDefaultAccordionValue(model.defaultExpanded),
  );
  const effectiveRequestIdentity = requestIdentity ?? requestKey;
  const hasUserChangedAccordionRef = useRef(false);
  const previousRequestIdentityRef = useRef(effectiveRequestIdentity);
  const previousHighestStatusWeightRef = useRef(0);
  const highestStatusWeight = model.status
    ? SECURITY_CHECK_STATUS_WEIGHT[model.status]
    : 0;

  useLayoutEffect(() => {
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
      const nextValue = getDefaultAccordionValue(model.defaultExpanded);
      setAccordionValue((currentValue) =>
        isAccordionValueEqual(currentValue, nextValue)
          ? currentValue
          : nextValue,
      );
    }

    previousHighestStatusWeightRef.current = Math.max(
      previousHighestStatusWeightRef.current,
      highestStatusWeight,
    );
  }, [effectiveRequestIdentity, highestStatusWeight, model.defaultExpanded]);

  const handleAccordionValueChange = useCallback((value: string[]) => {
    hasUserChangedAccordionRef.current = true;
    setAccordionValue(value);
  }, []);

  const hasAssets = (simulationComponents ?? []).some(
    (component) => component.assets.length > 0,
  );
  const hasFindings = model.findings.length > 0;
  const headerTitle = intl.formatMessage({
    id: ETranslations.dapp_connect_security_checks__title,
  });

  const renderHeaderTitle = () => (
    <SizableText size="$bodyMdMedium" numberOfLines={2} textAlign="left">
      {headerTitle}
    </SizableText>
  );

  const renderSummary = () => {
    if (!model.status) {
      return null;
    }
    if (model.status === 'loading') {
      return (
        <XStack
          testID={`${SignatureConfirmTestIDs.SecurityCheckCard}-loading`}
          alignItems="center"
          gap="$1.5"
          flexShrink={0}
        >
          <Spinner size="small" color="$iconSubdued" />
          <SizableText size="$bodySm" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_checking })}
          </SizableText>
        </XStack>
      );
    }
    const style = getFindingStyle(model.status);
    return (
      <XStack gap="$2" alignItems="center" flexShrink={0}>
        {model.isPending ? <Spinner size="small" color="$iconSubdued" /> : null}
        <Badge badgeType={style.badgeType} badgeSize="sm">
          {intl.formatMessage({ id: STATUS_LABEL_ID[model.status] })}
        </Badge>
      </XStack>
    );
  };

  const findingsSection = hasFindings ? (
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
          hoverStyle={{ bg: '$neutral3' }}
          pressStyle={{ bg: '$neutral3' }}
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
                {renderHeaderTitle()}
                {model.statusSourceTitle ? (
                  <SizableText
                    size="$bodySm"
                    color="$textSubdued"
                    numberOfLines={2}
                    textAlign="left"
                  >
                    {model.statusSourceTitle}
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
            {model.orderedCategories.map((category) => (
              <SecurityCheckCategoryGroup
                key={category}
                category={category}
                model={model}
                showLabel={model.orderedCategories.length > 1}
              />
            ))}
          </YStack>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  ) : null;

  const staticSection =
    !hasFindings && model.status ? (
      <XStack alignItems="center" gap="$2" px="$3" py="$2.5">
        <YStack flex={1} minWidth={0} gap="$0.5">
          {renderHeaderTitle()}
          {model.statusSourceTitle ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={2}>
              {model.statusSourceTitle}
            </SizableText>
          ) : null}
        </YStack>
        {renderSummary()}
      </XStack>
    ) : null;

  const securitySection = findingsSection ?? staticSection;
  const showSignGuardFooter = hasAssets || model.hasTransactionSecurityCheck;

  if (!hasAssets && !securitySection) {
    return null;
  }

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
