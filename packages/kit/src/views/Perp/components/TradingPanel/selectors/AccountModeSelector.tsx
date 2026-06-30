import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, useInPageDialog } from '@onekeyhq/components';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { isHyperLiquidUnifiedAccountMode } from '../../../utils/accountMode';
import {
  type IPerpsAccountModeOption,
  showAccountModeDialog,
} from '../modals/AccountModeModal';

function getAccountModeFromAbstraction({
  accountAddress,
  modeData,
}: {
  accountAddress?: string | null;
  modeData:
    | {
        accountAddress?: string | null;
        mode?: EHyperLiquidAbstractionMode;
      }
    | undefined;
}): IPerpsAccountModeOption {
  if (
    isHyperLiquidUnifiedAccountMode(modeData, accountAddress) &&
    modeData?.mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
  ) {
    return EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN;
  }
  return EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT;
}

const ACCOUNT_MODE_LABELS: Record<IPerpsAccountModeOption, ETranslations> = {
  [EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT]:
    ETranslations.perp_unified_account_short__title,
  [EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN]:
    ETranslations.perp_portfolio_margin_short__title,
};

const AccountModeSelector = memo(
  ({
    disabled = false,
    isMobile = false,
  }: {
    disabled?: boolean;
    isMobile?: boolean;
  }) => {
    const intl = useIntl();
    const dialog = useInPageDialog();
    const [abstractionMode] = usePerpsAbstractionModeAtom();
    const [perpsActiveAccount] = usePerpsActiveAccountAtom();
    const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
    const [draftMode, setDraftMode] = useState<IPerpsAccountModeOption>();

    // Before trading is enabled the confirm button is replaced by an "Enable
    // Trading" CTA whose flow force-sets unifiedAccount — so a PM pick here would
    // be silently dropped. Gate the selector until the account is ready.
    const isDisabled = disabled || !isAgentReady;

    const liveMode = useMemo(
      () =>
        getAccountModeFromAbstraction({
          accountAddress: perpsActiveAccount.accountAddress,
          modeData: abstractionMode,
        }),
      [abstractionMode, perpsActiveAccount.accountAddress],
    );
    const displayMode = draftMode ?? liveMode;

    // Drafts are per-account; reset when the account changes.
    useEffect(() => {
      setDraftMode(undefined);
    }, [perpsActiveAccount.accountAddress]);

    // Drop the draft once live mode catches up, so live stays the source of truth.
    useEffect(() => {
      setDraftMode((prev) =>
        prev !== undefined && prev === liveMode ? undefined : prev,
      );
    }, [liveMode]);

    const handlePress = useCallback(() => {
      if (isDisabled) return;
      showAccountModeDialog({
        dialog,
        initialMode: displayMode,
        onSelect: setDraftMode,
        title: intl.formatMessage({
          id: ETranslations.perp_account_mode__title,
        }),
      });
    }, [dialog, isDisabled, displayMode, intl]);

    return (
      <XStack
        onPress={handlePress}
        disabled={isDisabled}
        width="100%"
        height={isMobile ? 32 : 30}
        bg={isMobile ? '$bgSubdued' : '$bgStrong'}
        borderRadius="$2"
        alignItems="center"
        justifyContent="center"
        px={isMobile ? '$2.5' : '$3'}
        cursor="default"
        hoverStyle={{
          bg: '$bgStrongHover',
        }}
        pressStyle={{
          bg: '$bgStrongActive',
        }}
      >
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {intl.formatMessage({ id: ACCOUNT_MODE_LABELS[displayMode] })}
        </SizableText>
      </XStack>
    );
  },
);

AccountModeSelector.displayName = 'AccountModeSelector';

export { AccountModeSelector };
