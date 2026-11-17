import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Icon, SizableText, XStack, YStack } from '../../primitives';

import type { IDeviceStageWalletType } from './type';
import type { IKeyOfIcons } from '../../primitives';

/**
 * The wallet-creation fork's two options, to the ratified design (Figma
 * 21912-35639): filled full-pill rows, the small icon riding the title
 * line, the description spanning the row underneath, drill-in on the
 * trailing edge. Same copy as the live dialog's options. Standard is
 * the passphrase-less wallet; Hidden leads into the passphrase flow.
 * Choosing is the step's only exit; stepping away is the surface's own
 * dismissal.
 */

const ROW_HOVER = { bg: '$neutral6' } as const;
const ROW_PRESS = { bg: '$neutral7' } as const;
const ROW_FOCUS = {
  outlineColor: '$focusRing',
  outlineOffset: -2,
  outlineWidth: 2,
  outlineStyle: 'solid',
} as const;

function WalletTypeRow({
  walletType,
  icon,
  title,
  sub,
  onSelect,
}: {
  walletType: IDeviceStageWalletType;
  icon: IKeyOfIcons;
  title: string;
  sub: string;
  onSelect: (walletType: IDeviceStageWalletType) => void;
}) {
  const handlePress = useCallback(
    () => onSelect(walletType),
    [onSelect, walletType],
  );
  return (
    <XStack
      testID={`device-stage-wallet-type-${walletType}`}
      alignItems="center"
      gap="$2"
      pl="$4"
      pr="$2"
      py="$3"
      borderRadius="$6"
      borderCurve="continuous"
      bg="$neutral5"
      hoverStyle={ROW_HOVER}
      pressStyle={ROW_PRESS}
      focusable
      focusVisibleStyle={ROW_FOCUS}
      onPress={handlePress}
    >
      <YStack flex={1} gap="$1.5">
        <XStack alignItems="center" gap="$1.5">
          <Icon name={icon} size="$4.5" color="$icon" flexShrink={0} />
          <SizableText size="$bodyLgMedium">{title}</SizableText>
        </XStack>
        <SizableText size="$bodyMd" color="$textSubdued">
          {sub}
        </SizableText>
      </YStack>
      <Icon
        name="ChevronRightSmallOutline"
        size="$5"
        color="$iconSubdued"
        flexShrink={0}
      />
    </XStack>
  );
}

export function WalletTypeOptions({
  onSelect,
}: {
  onSelect: (walletType: IDeviceStageWalletType) => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$4">
      <WalletTypeRow
        walletType="standard"
        icon="Wallet4Outline"
        title={intl.formatMessage({ id: ETranslations.global_standard_wallet })}
        sub={intl.formatMessage({
          id: ETranslations.global_standard_wallet_desc,
        })}
        onSelect={onSelect}
      />
      <WalletTypeRow
        walletType="hidden"
        icon="LockOutline"
        title={intl.formatMessage({ id: ETranslations.global_hidden_wallet })}
        sub={intl.formatMessage({
          id: ETranslations.global_hidden_wallet_desc,
        })}
        onSelect={onSelect}
      />
    </YStack>
  );
}
