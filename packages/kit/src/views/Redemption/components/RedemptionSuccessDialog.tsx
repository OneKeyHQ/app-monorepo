import { useCallback, useEffect, useState } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useNavigateToReferralLevel } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/hooks/useNavigateToReferralLevel';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export interface ILevelUpgradeInfo {
  fromLevel?: number;
  toLevel?: number;
  fromLevelLabel?: string;
  toLevelLabel?: string;
  toLevelIcon?: string;
}

export interface IRedemptionSuccessDialogProps {
  upgradeInfo?: ILevelUpgradeInfo;
}

interface IRedemptionSuccessDialogContentProps {
  onClose?: () => void;
  upgradeInfo?: ILevelUpgradeInfo;
}

function RedemptionSuccessDialogContent({
  onClose,
  upgradeInfo,
}: IRedemptionSuccessDialogContentProps) {
  const intl = useIntl();
  const navigateToReferralLevel = useNavigateToReferralLevel();

  const [fromLevelLabel, setFromLevelLabel] = useState<string>(
    upgradeInfo?.fromLevelLabel ?? '',
  );
  const [toLevelLabel, setToLevelLabel] = useState<string>(
    upgradeInfo?.toLevelLabel ?? '',
  );
  const [toLevelIcon, setToLevelIcon] = useState<string | undefined>(
    upgradeInfo?.toLevelIcon,
  );

  useEffect(() => {
    const { fromLevel, toLevel } = upgradeInfo ?? {};
    if (fromLevel === undefined && toLevel === undefined) {
      return;
    }

    void (async () => {
      try {
        const levelDetail =
          await backgroundApiProxy.serviceReferralCode.getLevelDetail();

        if (fromLevel !== undefined && !fromLevelLabel) {
          const fromLevelData = levelDetail.levels.find(
            (level) => level.level === fromLevel,
          );
          if (fromLevelData?.label) {
            setFromLevelLabel(fromLevelData.label);
          }
        }

        if (toLevel !== undefined) {
          const toLevelData = levelDetail.levels.find(
            (level) => level.level === toLevel,
          );
          if (toLevelData) {
            if (!toLevelLabel && toLevelData.label) {
              setToLevelLabel(toLevelData.label);
            }
            if (!toLevelIcon && toLevelData.icon) {
              setToLevelIcon(toLevelData.icon);
            }
          }
        }
      } catch {
        // Level info is optional
      }
    })();
  }, [upgradeInfo, fromLevelLabel, toLevelLabel, toLevelIcon]);

  const handleDone = useCallback(() => {
    defaultLogger.referral.redemption.successDialogDoneClick();
    onClose?.();
  }, [onClose]);

  const handleViewChanges = useCallback(() => {
    defaultLogger.referral.redemption.successDialogViewChangesClick();
    onClose?.();
    void navigateToReferralLevel();
  }, [onClose, navigateToReferralLevel]);

  return (
    <YStack mx="$-5">
      <YStack alignItems="center">
        <Stack
          bg="$bgSuccessStrong"
          borderRadius="$full"
          p="$3"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="CheckLargeOutline" size="$10" color="$iconInverse" />
        </Stack>
      </YStack>

      <YStack gap="$1" pt="$5" pb="$2" px="$5" alignItems="center">
        <SizableText size="$headingXl" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.redemption_success_title,
          })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.redemption_received_message,
          })}
        </SizableText>
      </YStack>

      <YStack px="$5" pb="$5">
        <YStack
          bg="$bgSubdued"
          borderRadius="$3"
          py="$5"
          alignItems="center"
          gap="$2"
        >
          <XStack alignItems="center" justifyContent="center" gap="$2" w="100%">
            {toLevelIcon ? <Image w="$5" h="$5" src={toLevelIcon} /> : null}
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.redemption_commission_upgrade,
              })}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
            w="100%"
          >
            <FormattedMessage
              id={ETranslations.redemption_commission_upgrade_details}
              values={{
                Level1: fromLevelLabel,
                Level2: (
                  <SizableText size="$bodyMdMedium" color="$text">
                    {toLevelLabel}
                  </SizableText>
                ),
              }}
            />
          </SizableText>
        </YStack>
      </YStack>

      <Dialog.Footer
        onCancelText={intl.formatMessage({
          id: ETranslations.redemption_done_button,
        })}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_commission_upgrade_button2,
        })}
        onCancel={handleDone}
        onConfirm={handleViewChanges}
      />
    </YStack>
  );
}

export function showRedemptionSuccessDialog({
  upgradeInfo,
}: IRedemptionSuccessDialogProps): IDialogInstance {
  defaultLogger.referral.redemption.showSuccessDialog();

  const dialog = Dialog.show({
    showFooter: false,
    renderContent: (
      <RedemptionSuccessDialogContent
        upgradeInfo={upgradeInfo}
        onClose={async () => {
          await dialog.close();
        }}
      />
    ),
  });

  return dialog;
}
