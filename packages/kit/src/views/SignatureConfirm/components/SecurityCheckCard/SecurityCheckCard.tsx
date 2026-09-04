import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
  Divider,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { CheckingMark } from '../SignatureConfirmComponents/CheckingMark';

import { ConfirmCardFrame } from './ConfirmCardFrame';
import {
  canRetryTransactionSecurityCheck,
  getCardSecurityFindings,
} from './securityCheckModel';
import { showSecurityFindingDetails } from './SecurityFindingDetails';

import type {
  ISecurityCheckCategory,
  ISecurityCheckCoverageItem,
  ISecurityCheckCoverageSource,
  ISecurityCheckCoverageState,
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
const COVERAGE_CONTENT_PADDING = {
  px: '$5',
  pb: '$5',
  pt: platformEnv.isNative ? '$0' : '$5',
} as const;
const COVERAGE_PANEL_PROPS = { minWidth: 300 } as const;
const COVERAGE_STATE_ID: Record<ISecurityCheckCoverageState, ETranslations> = {
  pending: ETranslations.global_checking,
  completed: ETranslations.security_check_checked__title,
  failed: ETranslations.kyt_risk_check_failed__title,
  unknown: ETranslations.global_unverified,
  notApplicable: ETranslations.global_not_available,
  locked: ETranslations.prime_get_prime,
};
const COVERAGE_SOURCE_ICON: Record<ISecurityCheckCoverageSource, IKeyOfIcons> =
  {
    site: 'GlobusOutline',
    parser: 'FileTextOutline',
    requestScan: 'DocumentSearch2Outline',
  };

function getCoverageStateTone(state: ISecurityCheckCoverageState): {
  icon?: IKeyOfIcons;
  iconColor: IIconProps['color'];
  textColor: IIconProps['color'];
  pending?: boolean;
} {
  if (state === 'pending') {
    return {
      iconColor: '$iconSubdued',
      textColor: '$textSubdued',
      pending: true,
    };
  }
  if (state === 'completed') {
    return {
      icon: 'CheckRadioOutline',
      iconColor: '$icon',
      textColor: '$text',
    };
  }
  if (state === 'failed') {
    return {
      icon: 'XCircleOutline',
      iconColor: '$iconSubdued',
      textColor: '$textSubdued',
    };
  }
  if (state === 'unknown') {
    return {
      icon: 'QuestionmarkOutline',
      iconColor: '$iconSubdued',
      textColor: '$textSubdued',
    };
  }
  if (state === 'notApplicable') {
    return {
      icon: 'MinusCircleOutline',
      iconColor: '$iconDisabled',
      textColor: '$textSubdued',
    };
  }
  return {
    icon: 'LockOutline',
    iconColor: '$iconSubdued',
    textColor: '$textSubdued',
  };
}

function isMutedCoverageState(state: ISecurityCheckCoverageState) {
  return state === 'locked' || state === 'notApplicable';
}

function useOpenPrimeTransactionSecurity() {
  const navigation = useAppNavigation();
  return useCallback(() => {
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
}

function getOperationAnalysisTitleId(kind: ISecurityCheckViewModel['kind']) {
  return kind === 'message'
    ? ETranslations.dapp_connect_signature_analysis__title
    : ETranslations.dapp_connect_transaction_analysis__title;
}

function getCoverageTitleId(
  source: ISecurityCheckCoverageSource,
  kind: ISecurityCheckViewModel['kind'],
) {
  if (source === 'site') {
    return ETranslations.dapp_connect_site_security__title;
  }
  if (source === 'requestScan') {
    return ETranslations.prime_feature_transaction_security_check__title;
  }
  return getOperationAnalysisTitleId(kind);
}

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

function SecurityCheckCoverageRow({
  source,
  state,
  kind,
  onPress,
}: {
  source: ISecurityCheckCoverageSource;
  state: ISecurityCheckCoverageState;
  kind: ISecurityCheckViewModel['kind'];
  onPress?: () => void;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({
    id: getCoverageTitleId(source, kind),
  });
  const statusLabel = intl.formatMessage({ id: COVERAGE_STATE_ID[state] });
  const stateTone = getCoverageStateTone(state);
  const muted = isMutedCoverageState(state);

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      width="100%"
      userSelect="none"
      hoverStyle={onPress ? INVITE_HOVER_STYLE : undefined}
      pressStyle={onPress ? INVITE_PRESS_STYLE : undefined}
      hitSlop={onPress ? FINDING_DETAILS_HIT_SLOP : undefined}
      role={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${title}, ${statusLabel}` : undefined}
      onPress={onPress}
    >
      <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
        <Icon
          name={COVERAGE_SOURCE_ICON[source]}
          size="$4"
          color={muted ? '$iconDisabled' : '$iconSubdued'}
        />
        <SizableText
          size="$bodyMdMedium"
          color={muted ? '$textSubdued' : '$text'}
          flex={1}
          minWidth={0}
          numberOfLines={1}
        >
          {title}
        </SizableText>
      </XStack>
      <XStack alignItems="center" gap="$1" flexShrink={0}>
        {stateTone.pending ? (
          <CheckingMark accessibilityLabel={statusLabel} />
        ) : null}
        {!stateTone.pending && stateTone.icon ? (
          <Icon name={stateTone.icon} size="$3.5" color={stateTone.iconColor} />
        ) : null}
        <SizableText size="$bodySm" color={stateTone.textColor}>
          {statusLabel}
        </SizableText>
        {onPress ? (
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}

function PrimeInviteRow() {
  const intl = useIntl();
  const openPrime = useOpenPrimeTransactionSecurity();
  const inviteLabel = intl.formatMessage({
    id: ETranslations.know_more_about_this_transaction__desc,
  });

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
      onPress={openPrime}
    >
      <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
        <Stack width="$4" flexShrink={0} />
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

export function SecurityCheckCoverageList({
  kind,
  coverage,
  onLockedPress,
}: {
  kind: ISecurityCheckViewModel['kind'];
  coverage: ISecurityCheckCoverageItem[];
  onLockedPress?: () => void;
}) {
  const openPrime = useOpenPrimeTransactionSecurity();
  const handleLockedPress = onLockedPress ?? openPrime;
  return (
    <YStack {...COVERAGE_CONTENT_PADDING} gap="$3">
      {coverage.map((item) => (
        <SecurityCheckCoverageRow
          key={item.source}
          source={item.source}
          state={item.state}
          kind={kind}
          onPress={item.state === 'locked' ? handleLockedPress : undefined}
        />
      ))}
    </YStack>
  );
}

function SecurityCheckCoverageTooltip({
  title,
  kind,
  coverage,
}: {
  title: string;
  kind: ISecurityCheckViewModel['kind'];
  coverage: ISecurityCheckCoverageItem[];
}) {
  const openPrime = useOpenPrimeTransactionSecurity();
  return (
    <Popover
      title={title}
      hoverable
      placement="bottom-start"
      floatingPanelProps={COVERAGE_PANEL_PROPS}
      renderTrigger={
        <IconButton
          icon="InfoCircleOutline"
          variant="tertiary"
          iconSize="$4"
          iconColor="$iconSubdued"
          accessibilityLabel={title}
          testID={SignatureConfirmTestIDs.SecurityCheckCoverage}
        />
      }
      renderContent={({ closePopover }) => (
        <SecurityCheckCoverageList
          kind={kind}
          coverage={coverage}
          onLockedPress={() => {
            closePopover();
            openPrime();
          }}
        />
      )}
    />
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
  const style = getStatusTone(finding.status);
  const handlePress = useCallback(() => {
    showSecurityFindingDetails({ finding });
  }, [finding]);
  const titleSize = featured || emphasizeTitle ? '$bodyMdMedium' : '$bodyMd';

  return (
    <XStack
      gap="$2"
      alignItems="flex-start"
      onPress={finding.action ? handlePress : undefined}
      hoverStyle={finding.action ? INVITE_HOVER_STYLE : undefined}
      pressStyle={finding.action ? INVITE_PRESS_STYLE : undefined}
      hitSlop={finding.action ? FINDING_DETAILS_HIT_SLOP : undefined}
      role={finding.action ? 'button' : undefined}
      accessibilityLabel={
        finding.action
          ? [finding.title, finding.description].filter(Boolean).join(', ')
          : undefined
      }
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
        {finding.description ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {finding.description}
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
          id: getOperationAnalysisTitleId(kind),
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
  kind,
  title,
  findings,
  orderedCategories,
}: {
  kind: ISecurityCheckViewModel['kind'];
  title: string;
  findings: ISecurityCheckFinding[];
  orderedCategories: ISecurityCheckCategory[];
}) {
  const groupedFindings = {
    site: findings.filter((finding) => finding.category === 'site'),
    operation: findings.filter((finding) => finding.category === 'operation'),
  };
  const categories = orderedCategories.filter(
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
            kind={kind}
            showLabel={categories.length > 1}
          />
        ))}
      </YStack>
    ),
  });
}

function SecurityCheckHeader({
  model,
  status,
  title,
  statusLabel,
  onRetry,
}: {
  model: ISecurityCheckViewModel;
  status: ISecurityCheckStatus;
  title: string;
  statusLabel: string;
  onRetry?: () => void;
}) {
  const intl = useIntl();
  const showChecking = model.isPending;
  const style = getStatusTone(status);
  const showBadge = status !== 'loading' && status !== 'success';
  const showLoadingLabel = status === 'loading';
  const showSuccessLabel = status === 'success';
  const canRetry =
    Boolean(onRetry) &&
    !model.isPending &&
    canRetryTransactionSecurityCheck(model.findings);
  const retryLabel = intl.formatMessage({ id: ETranslations.global_retry });

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
      width="100%"
      flexWrap="wrap"
    >
      <XStack alignItems="center" gap="$1.5" minWidth={0}>
        {showChecking ? (
          <CheckingMark
            accessibilityLabel={intl.formatMessage({
              id: ETranslations.global_checking,
            })}
          />
        ) : (
          <Icon
            name={style.titleIcon}
            size="$4"
            color={style.iconColor}
            accessibilityLabel={statusLabel}
          />
        )}
        <SizableText size="$headingSm">{title}</SizableText>
        <SecurityCheckCoverageTooltip
          title={title}
          kind={model.kind}
          coverage={model.coverage}
        />
      </XStack>
      {showLoadingLabel || showSuccessLabel || showBadge ? (
        <XStack
          alignItems="center"
          gap="$2"
          ml="auto"
          maxWidth="100%"
          onPress={canRetry ? onRetry : undefined}
          hoverStyle={canRetry ? INVITE_HOVER_STYLE : undefined}
          pressStyle={canRetry ? INVITE_PRESS_STYLE : undefined}
          hitSlop={canRetry ? FINDING_DETAILS_HIT_SLOP : undefined}
          role={canRetry ? 'button' : undefined}
          accessibilityLabel={canRetry ? retryLabel : undefined}
          testID={
            canRetry ? SignatureConfirmTestIDs.SecurityCheckRetry : undefined
          }
          userSelect={canRetry ? 'none' : undefined}
        >
          {showLoadingLabel ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {`${statusLabel}...`}
            </SizableText>
          ) : null}
          {showSuccessLabel ? (
            <SizableText
              size="$bodySmMedium"
              color="$textSubdued"
              flexShrink={1}
            >
              {statusLabel}
            </SizableText>
          ) : null}
          {showBadge ? (
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
  const showViewAll = cardFindings.hasHiddenDecisionFindings;
  const handleViewAll = useCallback(() => {
    showAllSecurityFindings({
      kind: model.kind,
      title: headerTitle,
      findings: cardFindings.allDecisionFindings,
      orderedCategories: model.orderedCategories,
    });
  }, [
    cardFindings.allDecisionFindings,
    headerTitle,
    model.kind,
    model.orderedCategories,
  ]);
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
            status={model.status}
            title={headerTitle}
            statusLabel={statusLabel}
            onRetry={onRetry}
          />
          {model.showPrimeInvite ? <PrimeInviteRow /> : null}
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
