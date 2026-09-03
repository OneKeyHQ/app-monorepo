import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { CheckingMark } from '../SignatureConfirmComponents/CheckingMark';

import { ConfirmCardFrame } from './ConfirmCardFrame';
import {
  getCardSecurityFindings,
  getCeremonialFindingDescriptions,
  getVisibleSecurityFindings,
  omitCeremonialDescription,
  shouldShowAllSecurityFindings,
  shouldShowPrimeCredit,
} from './securityCheckModel';
import { showSecurityFindingDetails } from './SecurityFindingDetails';

import type {
  ISecurityCheckCategory,
  ISecurityCheckFinding,
  ISecurityCheckStatus,
  ISecurityCheckViewModel,
} from './securityCheckModel';

type IProps = {
  model: ISecurityCheckViewModel;
  onRetry?: () => void;
};

const STATUS_LABEL_ID: Record<ISecurityCheckStatus, ETranslations> = {
  critical: ETranslations.global_risk,
  warning:
    ETranslations.dapp_connect_security_checks_risk_review_required__title,
  unknown: ETranslations.global_unverified,
  check_failed: ETranslations.kyt_risk_check_failed__title,
  info: ETranslations.global_info,
  success: ETranslations.kyt_no_significant_risk_detected__title,
  loading: ETranslations.global_checking,
};

const FINDING_DETAILS_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };
const INVITE_HOVER_STYLE = { opacity: 0.7 } as const;
const INVITE_PRESS_STYLE = { opacity: 0.5 } as const;

function getStatusTone(status: ISecurityCheckStatus): {
  titleIcon: IKeyOfIcons;
  rowIcon: IKeyOfIcons;
  iconColor: IIconProps['color'];
  badgeType: IBadgeType;
} {
  if (status === 'critical') {
    return {
      titleIcon: 'ErrorSolid',
      rowIcon: 'ErrorOutline',
      iconColor: '$iconCritical',
      badgeType: 'critical',
    };
  }
  if (status === 'warning') {
    return {
      titleIcon: 'InfoSquareSolid',
      rowIcon: 'InfoSquareOutline',
      iconColor: '$iconCaution',
      badgeType: 'warning',
    };
  }
  if (status === 'unknown' || status === 'check_failed') {
    return {
      titleIcon: 'QuestionmarkSolid',
      rowIcon: 'QuestionmarkOutline',
      iconColor: '$iconSubdued',
      badgeType: 'default',
    };
  }
  if (status === 'success') {
    return {
      titleIcon: 'CheckRadioSolid',
      rowIcon: 'CheckRadioOutline',
      iconColor: '$iconSuccess',
      badgeType: 'success',
    };
  }
  return {
    titleIcon: 'InfoCircleSolid',
    rowIcon: 'InfoCircleOutline',
    iconColor: '$iconInfo',
    badgeType: 'info',
  };
}

function PrimeInviteRow() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const inviteLabel = intl.formatMessage({
    id: ETranslations.know_more_about_this_transaction__desc,
  });
  const handlePress = useCallback(() => {
    defaultLogger.prime.subscription.primeEntryClick({
      featureName: EPrimeFeatures.TransactionSecurityCheck,
      entryPoint: 'signatureConfirm',
      isPrimeActive: false,
    });
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        fromFeature: EPrimeFeatures.TransactionSecurityCheck,
      },
    });
  }, [navigation]);

  return (
    <XStack
      testID={SignatureConfirmTestIDs.SecurityCheckPrime}
      alignItems="center"
      justifyContent="space-between"
      gap="$1.5"
      width="100%"
      userSelect="none"
      hoverStyle={INVITE_HOVER_STYLE}
      pressStyle={INVITE_PRESS_STYLE}
      hitSlop={FINDING_DETAILS_HIT_SLOP}
      role="button"
      accessibilityLabel={inviteLabel}
      onPress={handlePress}
    >
      <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
        <Stack width="$5" flexShrink={0} />
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          flex={1}
          minWidth={0}
          numberOfLines={1}
        >
          {inviteLabel}
        </SizableText>
      </XStack>
      <XStack alignItems="center" gap="$0.5" flexShrink={0}>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.prime_status_prime })}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </XStack>
  );
}

function SecurityCheckFindingRow({
  finding,
  featured,
  emphasizeTitle,
}: {
  finding: ISecurityCheckFinding;
  featured?: boolean;
  emphasizeTitle?: boolean;
}) {
  const intl = useIntl();
  const style = getStatusTone(finding.status);
  const description = omitCeremonialDescription(
    finding.description,
    getCeremonialFindingDescriptions(intl),
  );
  const handlePress = useCallback(() => {
    showSecurityFindingDetails({ finding, description });
  }, [description, finding]);
  const titleSize = featured || emphasizeTitle ? '$bodyMdMedium' : '$bodyMd';

  return (
    <XStack
      gap="$2"
      alignItems="flex-start"
      onPress={finding.action ? handlePress : undefined}
      hoverStyle={finding.action ? INVITE_HOVER_STYLE : undefined}
      pressStyle={finding.action ? INVITE_PRESS_STYLE : undefined}
    >
      {featured ? null : (
        <YStack
          w="$4"
          h="$5"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon name={style.rowIcon} size="$4" color={style.iconColor} />
        </YStack>
      )}
      <YStack gap={featured ? '$1.5' : '$1'} flex={1} minWidth={0}>
        <SizableText size={titleSize}>{finding.title}</SizableText>
        {description ? (
          <SizableText
            size={featured ? '$bodySm' : '$bodyXs'}
            color="$textSubdued"
          >
            {description}
          </SizableText>
        ) : null}
      </YStack>
      {finding.action ? (
        <YStack h="$5" justifyContent="center" flexShrink={0}>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </YStack>
      ) : null}
    </XStack>
  );
}

function SecurityCheckCategoryGroup({
  category,
  findings,
  kind,
  showLabel,
}: {
  category: ISecurityCheckCategory;
  findings: ISecurityCheckFinding[];
  kind: ISecurityCheckViewModel['kind'];
  showLabel: boolean;
}) {
  const intl = useIntl();
  if (!findings.length) {
    return null;
  }
  const label =
    category === 'site'
      ? intl.formatMessage({ id: ETranslations.global_website })
      : intl.formatMessage({
          id:
            kind === 'message'
              ? ETranslations.dapp_connect_signature_analysis__title
              : ETranslations.dapp_connect_transaction_analysis__title,
        });

  return (
    <YStack gap="$1.5">
      {showLabel ? (
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {label}
        </SizableText>
      ) : null}
      <YStack gap="$2.5">
        {findings.map((finding) => (
          <SecurityCheckFindingRow
            key={finding.id}
            finding={finding}
            emphasizeTitle
          />
        ))}
      </YStack>
    </YStack>
  );
}

function showAllSecurityFindings({
  model,
  statusLabel,
  title,
}: {
  model: ISecurityCheckViewModel;
  statusLabel: string;
  title: string;
}) {
  const groupedFindings = {
    site: getVisibleSecurityFindings(model.groupedFindings.site, statusLabel),
    operation: getVisibleSecurityFindings(
      model.groupedFindings.operation,
      statusLabel,
    ),
  };
  const categories = model.orderedCategories.filter(
    (category) => groupedFindings[category].length > 0,
  );

  Dialog.show({
    title,
    showFooter: false,
    renderContent: (
      <YStack gap="$4">
        {categories.map((category) => (
          <SecurityCheckCategoryGroup
            key={category}
            category={category}
            findings={groupedFindings[category]}
            kind={model.kind}
            showLabel={categories.length > 1}
          />
        ))}
      </YStack>
    ),
  });
}

function SecurityCheckHeader({
  model,
  title,
  statusLabel,
  onRetry,
}: {
  model: ISecurityCheckViewModel;
  title: string;
  statusLabel: string;
  onRetry?: () => void;
}) {
  const intl = useIntl();
  const showChecking = model.status === 'loading' || model.isPending;
  const style = model.status ? getStatusTone(model.status) : undefined;
  const showBadge = Boolean(
    model.status &&
    model.status !== 'loading' &&
    model.status !== 'success' &&
    style,
  );
  const showLoadingLabel = model.status === 'loading';
  const showSuccessLabel = model.status === 'success';
  const canRetry = model.status === 'check_failed' && Boolean(onRetry);
  const retryLabel = intl.formatMessage({ id: ETranslations.global_retry });

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      width="100%"
      flexWrap="wrap"
      onPress={canRetry ? onRetry : undefined}
      hoverStyle={canRetry ? INVITE_HOVER_STYLE : undefined}
      pressStyle={canRetry ? INVITE_PRESS_STYLE : undefined}
      hitSlop={canRetry ? FINDING_DETAILS_HIT_SLOP : undefined}
      role={canRetry ? 'button' : undefined}
      accessibilityLabel={canRetry ? retryLabel : undefined}
      testID={canRetry ? SignatureConfirmTestIDs.SecurityCheckRetry : undefined}
      userSelect={canRetry ? 'none' : undefined}
    >
      <XStack alignItems="center" gap="$1.5" minWidth={0}>
        {showChecking ? <CheckingMark /> : null}
        {!showChecking && style ? (
          <Icon
            name={style.titleIcon}
            size="$5"
            color={style.iconColor}
            accessibilityLabel={statusLabel}
          />
        ) : null}
        <SizableText size="$headingSm">{title}</SizableText>
      </XStack>
      {showLoadingLabel || showSuccessLabel || showBadge ? (
        <XStack alignItems="center" gap="$2" ml="auto" maxWidth="100%">
          {showLoadingLabel ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`${statusLabel}...`}
            </SizableText>
          ) : null}
          {showSuccessLabel ? (
            <SizableText size="$bodySmMedium" color="$text" flexShrink={1}>
              {statusLabel}
            </SizableText>
          ) : null}
          {showBadge && style ? (
            <Badge badgeType={style.badgeType} badgeSize="sm">
              {statusLabel}
            </Badge>
          ) : null}
          {canRetry ? (
            <Icon
              name="RotateCounterclockwiseOutline"
              size="$4"
              color="$iconSubdued"
            />
          ) : null}
        </XStack>
      ) : null}
    </XStack>
  );
}

function SecurityCheckViewAllButton({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  return (
    <SizableText
      testID={SignatureConfirmTestIDs.SecurityCheckViewAll}
      size="$bodySmMedium"
      color="$textSubdued"
      userSelect="none"
      hoverStyle={{ color: '$text' }}
      pressStyle={{ color: '$text' }}
      onPress={onPress}
      hitSlop={FINDING_DETAILS_HIT_SLOP}
      role="button"
      alignSelf="flex-start"
    >
      {intl.formatMessage({ id: ETranslations.tray_view_all })}
    </SizableText>
  );
}

function SecurityCheckCard({ model, onRetry }: IProps) {
  const intl = useIntl();
  const headerTitle = intl.formatMessage({
    id: ETranslations.dapp_connect_security_checks__title,
  });
  const statusLabel = model.status
    ? intl.formatMessage({ id: STATUS_LABEL_ID[model.status] })
    : '';
  const cardFindings = useMemo(
    () => getCardSecurityFindings(model.findings),
    [model.findings],
  );
  const showViewAll = shouldShowAllSecurityFindings({
    findings: model.findings,
    shownCount: cardFindings.shownCount,
    statusLabel,
  });
  const handleViewAll = useCallback(() => {
    showAllSecurityFindings({
      model,
      statusLabel,
      title: headerTitle,
    });
  }, [headerTitle, model, statusLabel]);
  const showPrime = shouldShowPrimeCredit({
    status: model.status,
    isPrimeUser: model.isPrimeUser,
    hasTransactionSecurityCheck: model.hasTransactionSecurityCheck,
  });

  if (!model.status) {
    return null;
  }

  return (
    <ConfirmCardFrame>
      <YStack
        testID={SignatureConfirmTestIDs.SecurityCheckCard}
        px="$4"
        py="$3.5"
        gap="$3"
      >
        <YStack gap="$2">
          <SecurityCheckHeader
            model={model}
            title={headerTitle}
            statusLabel={statusLabel}
            onRetry={onRetry}
          />
          {showPrime ? <PrimeInviteRow /> : null}
        </YStack>
        {cardFindings.featured ? (
          <YStack gap="$4">
            <SecurityCheckFindingRow finding={cardFindings.featured} featured />
            {cardFindings.listed.length ? (
              <YStack gap="$3">
                <Divider />
                {cardFindings.listed.map((finding) => (
                  <SecurityCheckFindingRow key={finding.id} finding={finding} />
                ))}
              </YStack>
            ) : null}
            {showViewAll ? (
              <SecurityCheckViewAllButton onPress={handleViewAll} />
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </ConfirmCardFrame>
  );
}

export default memo(SecurityCheckCard);
