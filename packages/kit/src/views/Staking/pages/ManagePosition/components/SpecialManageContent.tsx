import { useCallback, useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnHistoryActionIcon,
  IEarnManagePageResponse,
  IStakeTag,
  IStakeTransactionConfirmation,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../../components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../../components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../../components/ProtocolDetails/EarnTooltip';

import { HeaderRight } from './HeaderRight';
import { ESpecialManageLayoutType } from './types';

import type { ISpecialManageButtonConfig } from './types';

interface ISpecialManageContentProps {
  holdings?: IEarnManagePageResponse['holdings'];
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: () => void;
  showApyDetail?: boolean;
  isInModalContext?: boolean;
  beforeFooter?: React.ReactElement | null;
  buttonConfig: ISpecialManageButtonConfig;
  transactionConfirmation?: IStakeTransactionConfirmation;
  fallbackTokenImageUri?: string;
  fallbackSymbol?: string;
  // PendingIndicator props
  indicatorAccountId?: string;
  networkId?: string;
  stakeTag?: IStakeTag;
  onIndicatorRefresh?: () => void;
  onRefreshPendingRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export function SpecialManageContent({
  holdings,
  historyAction,
  onHistory,
  showApyDetail = false,
  isInModalContext = false,
  beforeFooter,
  buttonConfig,
  transactionConfirmation,
  fallbackTokenImageUri,
  fallbackSymbol,
  indicatorAccountId,
  networkId,
  stakeTag,
  onIndicatorRefresh,
  onRefreshPendingRef,
}: ISpecialManageContentProps) {
  const intl = useIntl();
  const isSingleButton = buttonConfig.type === ESpecialManageLayoutType.Single;
  const primaryButton = buttonConfig.buttons.primary;
  const secondaryButton = buttonConfig.buttons.secondary;

  // Action buttons for non-modal context
  const actionButtonsContent = useMemo(() => {
    if (isInModalContext) return null;

    if (isSingleButton && primaryButton) {
      return (
        <Button
          variant={primaryButton.variant ?? 'primary'}
          onPress={primaryButton.onPress}
          disabled={primaryButton.disabled}
          loading={primaryButton.loading}
        >
          {primaryButton.text}
        </Button>
      );
    }

    if (!isSingleButton && (primaryButton || secondaryButton)) {
      return (
        <XStack gap="$3">
          {secondaryButton ? (
            <YStack flex={1}>
              <Button
                variant={secondaryButton.variant}
                onPress={secondaryButton.onPress}
                disabled={secondaryButton.disabled}
                loading={secondaryButton.loading}
              >
                {secondaryButton.text}
              </Button>
            </YStack>
          ) : null}
          {primaryButton ? (
            <YStack flex={1}>
              <Button
                variant={primaryButton.variant ?? 'primary'}
                onPress={primaryButton.onPress}
                disabled={primaryButton.disabled}
                loading={primaryButton.loading}
              >
                {primaryButton.text}
              </Button>
            </YStack>
          ) : null}
        </XStack>
      );
    }

    return null;
  }, [isInModalContext, isSingleButton, primaryButton, secondaryButton]);

  // Render header right content (History button or PendingIndicator)
  const renderHistoryRightButton = useCallback(() => {
    if (!historyAction || historyAction.disabled) {
      return null;
    }

    if (indicatorAccountId && networkId && stakeTag) {
      return (
        <HeaderRight
          accountId={indicatorAccountId}
          networkId={networkId}
          stakeTag={stakeTag}
          historyAction={historyAction}
          onHistory={onHistory}
          onRefresh={onIndicatorRefresh}
          onRefreshPending={(refreshFn) => {
            if (onRefreshPendingRef) {
              onRefreshPendingRef.current = refreshFn;
            }
          }}
        />
      );
    }

    return (
      <Button
        variant="tertiary"
        size="small"
        icon="ClockTimeHistoryOutline"
        onPress={() => onHistory?.()}
        mt={isInModalContext ? '$1' : undefined}
      >
        {historyAction.text?.text ||
          intl.formatMessage({ id: ETranslations.global_history })}
      </Button>
    );
  }, [
    historyAction,
    indicatorAccountId,
    networkId,
    stakeTag,
    onHistory,
    onIndicatorRefresh,
    onRefreshPendingRef,
    isInModalContext,
    intl,
  ]);

  // Footer for modal context
  const footerContent = useMemo(() => {
    if (!isInModalContext) return null;

    if (buttonConfig.footer) {
      return buttonConfig.footer;
    }

    if (isSingleButton && primaryButton) {
      return (
        <Page.FooterActions
          onConfirmText={primaryButton.text}
          confirmButtonProps={{
            onPress: primaryButton.onPress,
            disabled: primaryButton.disabled,
            loading: primaryButton.loading,
          }}
        />
      );
    }

    if (!isSingleButton) {
      return (
        <Page.FooterActions
          onCancelText={secondaryButton?.text}
          onConfirmText={primaryButton?.text}
          cancelButtonProps={
            secondaryButton
              ? {
                  onPress: secondaryButton.onPress,
                  disabled: secondaryButton.disabled,
                  loading: secondaryButton.loading,
                }
              : undefined
          }
          confirmButtonProps={
            primaryButton
              ? {
                  onPress: primaryButton.onPress,
                  disabled: primaryButton.disabled,
                  loading: primaryButton.loading,
                }
              : undefined
          }
        />
      );
    }

    return null;
  }, [
    isInModalContext,
    isSingleButton,
    primaryButton,
    secondaryButton,
    buttonConfig.footer,
  ]);

  return (
    <>
      <YStack px="$5" gap="$5">
        {/* Header with History button and PendingIndicator */}
        <XStack
          jc="space-between"
          ai="center"
          mt={isInModalContext ? '$1' : undefined}
        >
          <SizableText size="$headingMd" color="$text">
            {holdings?.title.text ||
              intl.formatMessage({ id: ETranslations.earn_holdings })}
          </SizableText>
          {renderHistoryRightButton()}
        </XStack>

        {/* Holdings Section */}
        <YStack gap="$2">
          {/* Tags */}
          {holdings?.tags && holdings.tags.length > 0 ? (
            <XStack gap="$2">
              {holdings.tags.map((tag, index) => (
                <Badge key={index} badgeType={tag.badge} badgeSize="lg">
                  {tag.tag}
                </Badge>
              ))}
            </XStack>
          ) : null}

          {/* Title with Token Icon on the right */}
          <XStack jc="space-between" ai="center">
            <YStack gap="$1" flex={1}>
              <EarnText
                text={
                  holdings?.title || {
                    text: `0 ${fallbackSymbol || ''}`,
                  }
                }
                size="$heading3xl"
              />
              <EarnText
                text={holdings?.description}
                size="$bodyMd"
                color="$textSubdued"
              />
            </YStack>
            <Token
              size="lg"
              tokenImageUri={holdings?.token?.logoURI || fallbackTokenImageUri}
              networkImageUri={holdings?.network?.logoURI}
            />
          </XStack>
        </YStack>

        {/* APY Detail Section */}
        {showApyDetail && transactionConfirmation?.apyDetail ? (
          <XStack gap="$1" ai="center" mb="$3.5">
            <EarnText
              text={transactionConfirmation.apyDetail.description}
              size="$headingLg"
              color="$textSuccess"
            />
            <EarnActionIcon
              title={transactionConfirmation.apyDetail.title.text}
              actionIcon={transactionConfirmation.apyDetail.button}
            />
          </XStack>
        ) : null}

        {/* Rewards Section */}
        {!isEmpty(transactionConfirmation?.rewards) ? (
          <>
            <Divider />
            <YStack gap="$1.5">
              {transactionConfirmation?.title ? (
                <XStack ai="center" gap="$1">
                  <EarnText
                    text={transactionConfirmation.title}
                    color="$textSubdued"
                    size="$bodyMd"
                    boldTextProps={{
                      size: '$bodyMdMedium',
                    }}
                  />
                </XStack>
              ) : null}
              {transactionConfirmation?.rewards?.map((reward) => (
                <XStack
                  key={reward.title.text}
                  gap="$1"
                  ai="flex-start"
                  mt="$1.5"
                  flexWrap="wrap"
                >
                  <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                    <EarnText text={reward.title} />
                    <XStack gap="$1" flex={1} flexWrap="wrap" ai="center">
                      {reward.description ? (
                        <EarnText text={reward.description} flexShrink={1} />
                      ) : null}
                      <EarnTooltip tooltip={reward.tooltip} />
                    </XStack>
                  </XStack>
                </XStack>
              ))}
            </YStack>
          </>
        ) : null}

        {/* Before Footer (including noAddressWarning and alerts) */}
        {beforeFooter}

        {/* Action Buttons - not in modal */}
        {actionButtonsContent}
      </YStack>

      {/* Footer - in modal */}
      {footerContent ? <Page.Footer>{footerContent}</Page.Footer> : null}
    </>
  );
}
