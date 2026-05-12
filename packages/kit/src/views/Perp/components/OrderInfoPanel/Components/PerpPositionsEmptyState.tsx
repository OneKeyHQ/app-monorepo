import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Illustration,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useShowDepositWithdrawModal } from '../../../hooks/useShowDepositWithdrawModal';
import { useShowGuide } from '../../../hooks/useShowGuide';
import { PerpGuidePopover } from '../../Guide/PerpGuidePopover';

function ActionButton({
  label,
  icon,
  width,
  height,
  onPress,
  disabled,
}: {
  label: string;
  icon: 'DownloadOutline' | 'BookOpenOutline';
  width: number;
  height: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      width={width}
      borderRadius="$full"
      size="small"
      h={height}
      px="$3"
      variant="secondary"
      onPress={onPress}
      disabled={disabled}
      childrenAsText={false}
    >
      <XStack gap="$1.5" alignItems="center">
        <Icon name={icon} size="$4" />
        <SizableText size="$bodySmMedium">{label}</SizableText>
      </XStack>
    </Button>
  );
}

export function PerpPositionsEmptyState({ isMobile }: { isMobile?: boolean }) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const { showGuide } = useShowGuide();
  const [activeAccount] = usePerpsActiveAccountAtom();

  const buttonWidth = isMobile ? 136 : 132;
  const buttonHeight = isMobile ? 32 : 28;
  const hasAccountAddress = Boolean(activeAccount?.accountAddress);
  const useGuidePopover = gtMd;
  const guideLabel = intl.formatMessage({
    id: ETranslations.perp_guide_title,
  });
  const guideButton = (
    <ActionButton
      width={buttonWidth}
      height={buttonHeight}
      icon="BookOpenOutline"
      label={guideLabel}
      onPress={useGuidePopover ? undefined : showGuide}
    />
  );

  return (
    <YStack
      flex={1}
      justifyContent="center"
      alignItems="center"
      px="$5"
      py="$6"
    >
      <YStack
        width="100%"
        maxWidth={isMobile ? 320 : 420}
        gap="$3"
        alignItems="center"
      >
        <Illustration name="Orders" size={isMobile ? 88 : 100} mb={-24} />

        <SizableText
          size={isMobile ? '$bodyXs' : '$bodySm'}
          color="$textSubdued"
          textAlign="center"
          maxWidth={isMobile ? 280 : 360}
        >
          {intl.formatMessage({
            id: ETranslations.perp_position_empty_desc,
          })}
        </SizableText>

        <XStack
          gap="$2"
          flexDirection="row"
          alignItems="center"
          justifyContent="center"
        >
          <ActionButton
            width={buttonWidth}
            icon="DownloadOutline"
            height={buttonHeight}
            label={intl.formatMessage({
              id: ETranslations.perp_trade_deposit,
            })}
            onPress={() => void showDepositWithdrawModal('deposit')}
            disabled={!hasAccountAddress}
          />
          {useGuidePopover ? (
            <YStack width={buttonWidth}>
              <PerpGuidePopover renderTrigger={guideButton} />
            </YStack>
          ) : (
            guideButton
          )}
        </XStack>
      </YStack>
    </YStack>
  );
}
