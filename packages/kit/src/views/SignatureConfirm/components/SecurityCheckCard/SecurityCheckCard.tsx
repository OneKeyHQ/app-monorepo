import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType, IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  ButtonFrame,
  Dialog,
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
  warning: ETranslations.global_warning,
  unknown: ETranslations.global_unverified,
  check_failed: ETranslations.global_unverified,
  info: ETranslations.global_info,
  success: ETranslations.kyt_no_significant_risk_detected__title,
  loading: ETranslations.global_checking,
};

const FINDING_DETAILS_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };
const INVITE_HOVER_STYLE = { opacity: 0.7 } as const;
const INVITE_PRESS_STYLE = { opacity: 0.5 } as const;
const INTERACTIVE_FOCUS_STYLE = {
  outlineColor: '$focusRing',
  outlineWidth: 2,
  outlineStyle: 'solid',
  outlineOffset: 0,
} as const;
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
  unavailable: ETranslations.transaction_security_check_unavailable__title,
  networkUnsupported:
    ETranslations.transaction_security_network_not_supported__title,
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
  if (
    state === 'notApplicable' ||
    state === 'unavailable' ||
    state === 'networkUnsupported'
  ) {
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
  return (
    state === 'locked' ||
    state === 'notApplicable' ||
    state === 'unavailable' ||
    state === 'networkUnsupported'
  );
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
  const CoverageRowFrame = onPress ? ButtonFrame : XStack;

  return (
    <CoverageRowFrame
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      width="100%"
      minHeight="$6"
      p="$0"
      borderWidth={0}
      borderRadius="$0"
      bg="$transparent"
      userSelect="none"
      hoverStyle={onPress ? INVITE_HOVER_STYLE : undefined}
      pressStyle={onPress ? INVITE_PRESS_STYLE : undefined}
      hitSlop={onPress ? FINDING_DETAILS_HIT_SLOP : undefined}
      role={onPress ? 'button' : undefined}
      focusable={Boolean(onPress)}
      focusVisibleStyle={onPress ? INTERACTIVE_FOCUS_STYLE : undefined}
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
          textAlign="left"
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
          <Icon name={stateTone.icon} size="$4" color={stateTone.iconColor} />
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
    </CoverageRowFrame>
  );
}

function PrimeInviteRow() {
  const intl = useIntl();
  const openPrime = useOpenPrimeTransactionSecurity();
  const inviteLabel = intl.formatMessage({
    id: ETranslations.know_more_about_this_transaction__desc,
  });
  const primeLabel = intl.formatMessage({
    id: ETranslations.prime_status_prime,
  });

  return (
    <ButtonFrame
      testID={SignatureConfirmTestIDs.SecurityCheckPrime}
      alignItems="center"
      justifyContent="space-between"
      gap="$1.5"
      width="100%"
      minHeight="$6"
      p="$0"
      borderWidth={0}
      borderRadius="$0"
      bg="$transparent"
      userSelect="none"
      hoverStyle={INVITE_HOVER_STYLE}
      pressStyle={INVITE_PRESS_STYLE}
      hitSlop={FINDING_DETAILS_HIT_SLOP}
      role="button"
      focusable
      focusVisibleStyle={INTERACTIVE_FOCUS_STYLE}
      accessibilityLabel={`${inviteLabel}, ${primeLabel}`}
      onPress={openPrime}
    >
      <XStack alignItems="center" gap="$1.5" flex={1} minWidth={0}>
        <Stack width="$4" flexShrink={0} />
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          textAlign="left"
          flex={1}
          minWidth={0}
          numberOfLines={1}
        >
          {inviteLabel}
        </SizableText>
      </XStack>
      <XStack alignItems="center" gap="$0.5" flexShrink={0}>
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {primeLabel}
        </SizableText>
        <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
      </XStack>
    </ButtonFrame>
  );
}

function SecurityCheckCoverageList({
  kind,
  coverage,
  onLockedPress,
}: {
  kind: ISecurityCheckViewModel['kind'];
  coverage: ISecurityCheckCoverageItem[];
  onLockedPress: () => void;
}) {
  return (
    <YStack {...COVERAGE_CONTENT_PADDING} gap="$3">
      {coverage.map((item) => (
        <SecurityCheckCoverageRow
          key={item.source}
          source={item.source}
          state={item.state}
          kind={kind}
          onPress={item.state === 'locked' ? onLockedPress : undefined}
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
  onRetry,
  standalone,
}: {
  finding: ISecurityCheckFinding;
  onRetry?: () => void;
  standalone?: boolean;
}) {
  const intl = useIntl();
  const isCheckFailed = canRetryTransactionSecurityCheck([finding]);
  const displayStatus = isCheckFailed ? 'check_failed' : finding.status;
  const style = getStatusTone(displayStatus);
  const statusLabel = intl.formatMessage({
    id: STATUS_LABEL_ID[displayStatus],
  });
  const retryLabel = intl.formatMessage({ id: ETranslations.global_retry });
  const canRetry = Boolean(onRetry) && isCheckFailed;
  const FindingRowFrame = finding.action ? ButtonFrame : XStack;
  const handlePress = useCallback(() => {
    showSecurityFindingDetails({ finding });
  }, [finding]);

  return (
    <FindingRowFrame
      gap="$1.5"
      alignItems="flex-start"
      justifyContent="flex-start"
      width="100%"
      minHeight="$6"
      p="$0"
      borderWidth={0}
      borderRadius="$0"
      bg="$transparent"
      onPress={finding.action ? handlePress : undefined}
      hoverStyle={finding.action ? INVITE_HOVER_STYLE : undefined}
      pressStyle={finding.action ? INVITE_PRESS_STYLE : undefined}
      hitSlop={finding.action ? FINDING_DETAILS_HIT_SLOP : undefined}
      role={finding.action ? 'button' : undefined}
      focusable={Boolean(finding.action)}
      focusVisibleStyle={finding.action ? INTERACTIVE_FOCUS_STYLE : undefined}
      accessibilityLabel={
        finding.action
          ? [statusLabel, finding.title, finding.description]
              .filter(Boolean)
              .join(', ')
          : undefined
      }
    >
      <YStack
        w="$4"
        h="$5"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        {standalone ? null : (
          <Icon
            name={style.rowIcon}
            size="$4"
            color={style.iconColor}
            accessibilityLabel={finding.action ? undefined : statusLabel}
          />
        )}
      </YStack>
      <YStack gap={standalone ? '$1.5' : '$1'} flex={1} minWidth={0}>
        <SizableText size="$bodyMdMedium" textAlign="left">
          {finding.title}
        </SizableText>
        {finding.description ? (
          <SizableText size="$bodySm" color="$textSubdued" textAlign="left">
            {finding.description}
          </SizableText>
        ) : null}
      </YStack>
      {canRetry ? (
        <ButtonFrame
          h="$6"
          gap="$1"
          alignItems="center"
          flexShrink={0}
          p="$0"
          borderWidth={0}
          borderRadius="$0"
          bg="$transparent"
          onPress={onRetry}
          hoverStyle={INVITE_HOVER_STYLE}
          pressStyle={INVITE_PRESS_STYLE}
          hitSlop={FINDING_DETAILS_HIT_SLOP}
          role="button"
          focusable
          focusVisibleStyle={INTERACTIVE_FOCUS_STYLE}
          accessibilityLabel={retryLabel}
          testID={SignatureConfirmTestIDs.SecurityCheckRetry}
          userSelect="none"
        >
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {retryLabel}
          </SizableText>
          <Icon
            name="RotateCounterclockwiseOutline"
            size="$4"
            color="$iconSubdued"
          />
        </ButtonFrame>
      ) : null}
      {!canRetry && finding.action ? (
        <YStack h="$6" justifyContent="center" flexShrink={0}>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        </YStack>
      ) : null}
    </FindingRowFrame>
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
          <SecurityCheckFindingRow key={finding.id} finding={finding} />
        ))}
      </YStack>
    </YStack>
  );
}

function showAllSecurityFindings({
  kind,
  title,
  findings,
}: {
  kind: ISecurityCheckViewModel['kind'];
  title: string;
  findings: ISecurityCheckFinding[];
}) {
  const groupedFindings = {
    site: findings.filter((finding) => finding.category === 'site'),
    operation: findings.filter((finding) => finding.category === 'operation'),
  };
  const categories = [...new Set(findings.map((finding) => finding.category))];

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
}: {
  model: ISecurityCheckViewModel;
  status: ISecurityCheckStatus;
  title: string;
  statusLabel: string;
}) {
  const intl = useIntl();
  const showChecking = model.isPending;
  const style = getStatusTone(status);
  const showBadge = status !== 'loading' && status !== 'success';
  const showLoadingLabel = status === 'loading';
  const showSuccessLabel = status === 'success';

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
        <XStack alignItems="center" gap="$2" ml="auto" maxWidth="100%">
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
        </XStack>
      ) : null}
    </XStack>
  );
}

function SecurityCheckViewAllButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const intl = useIntl();
  const label = `${intl.formatMessage({
    id: ETranslations.tray_view_all,
  })} (${intl.formatNumber(count)})`;
  return (
    <ButtonFrame
      testID={SignatureConfirmTestIDs.SecurityCheckViewAll}
      minHeight="$6"
      p="$0"
      borderWidth={0}
      borderRadius="$0"
      bg="$transparent"
      alignItems="center"
      justifyContent="flex-start"
      gap="$1.5"
      userSelect="none"
      hoverStyle={INVITE_HOVER_STYLE}
      pressStyle={INVITE_PRESS_STYLE}
      onPress={onPress}
      hitSlop={FINDING_DETAILS_HIT_SLOP}
      role="button"
      focusable
      focusVisibleStyle={INTERACTIVE_FOCUS_STYLE}
      accessibilityLabel={label}
      alignSelf="flex-start"
    >
      <Stack width="$4" flexShrink={0} />
      <SizableText size="$bodySmMedium" color="$textSubdued" textAlign="left">
        {label}
      </SizableText>
    </ButtonFrame>
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
  const isStandaloneFinding = cardFindings.visibleFindings.length === 1;
  const showViewAll = cardFindings.hasHiddenDecisionFindings;
  const handleViewAll = useCallback(() => {
    showAllSecurityFindings({
      kind: model.kind,
      title: headerTitle,
      findings: cardFindings.allDecisionFindings,
    });
  }, [cardFindings.allDecisionFindings, headerTitle, model.kind]);
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
          />
          {model.showPrimeInvite ? <PrimeInviteRow /> : null}
        </YStack>
        {cardFindings.visibleFindings.length ? (
          <YStack gap="$4">
            <YStack gap="$3">
              {cardFindings.visibleFindings.map((finding) => (
                <SecurityCheckFindingRow
                  key={finding.id}
                  finding={finding}
                  onRetry={model.isPending ? undefined : onRetry}
                  standalone={isStandaloneFinding}
                />
              ))}
            </YStack>
            {showViewAll ? (
              <SecurityCheckViewAllButton
                count={cardFindings.allDecisionFindings.length}
                onPress={handleViewAll}
              />
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </ConfirmCardFrame>
  );
}

export default memo(SecurityCheckCard);
