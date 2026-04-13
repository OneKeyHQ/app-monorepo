import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Icon,
  Popover,
  SizableText,
  Switch,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

import { showPerpFeeTierDialog } from './TradingPanel/components/PerpFeeTierPopover';

const ABSTRACTION_MODE_OPTIONS = [
  {
    label: 'Unified Account',
    value: 'u' as const,
    mode: EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT,
  },
  {
    label: 'Disabled',
    value: 'i' as const,
    mode: EHyperLiquidAbstractionMode.DISABLED,
  },
  {
    label: 'Portfolio Margin',
    value: 'p' as const,
    mode: EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN,
  },
];

function DevAbstractionModeSelector() {
  const [modeData] = usePerpsAbstractionModeAtom();
  const [activeAccount] = usePerpsActiveAccountAtom();

  const modeMap = {
    u: 'unifiedAccount',
    i: 'disabled',
    p: 'portfolioMargin',
  } as const;

  const handleSetMode = async (mode: 'i' | 'u' | 'p') => {
    if (!activeAccount?.accountId || !activeAccount?.accountAddress) return;
    try {
      await backgroundApiProxy.serviceHyperliquidExchange.setAbstractionWithUserWallet(
        {
          userAccountId: activeAccount.accountId,
          userAddress: activeAccount.accountAddress,
          abstraction: modeMap[mode],
        },
      );
      await backgroundApiProxy.serviceHyperliquid.fetchUserAbstraction(
        activeAccount.accountAddress,
      );
    } catch (e) {
      Toast.error({ title: (e as Error)?.message || 'Failed to set mode' });
    }
  };

  if (!platformEnv.isDev) {
    return null;
  }

  return (
    <YStack
      px="$2.5"
      pt="$2"
      gap="$2"
      borderTopWidth={1}
      borderColor="$borderSubdued"
      mt="$2"
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        Account Mode
      </SizableText>
      <XStack gap="$2" flexWrap="wrap">
        {ABSTRACTION_MODE_OPTIONS.map((opt) => {
          const isActive = modeData?.mode === opt.mode;
          return (
            <SizableText
              key={opt.value}
              size="$bodySm"
              px="$2"
              py="$1"
              borderRadius="$2"
              borderWidth={1}
              borderColor={isActive ? '$borderActive' : '$borderSubdued'}
              backgroundColor={isActive ? '$bgActive' : '$bgSubdued'}
              cursor="pointer"
              onPress={() => handleSetMode(opt.value)}
            >
              {opt.label}
            </SizableText>
          );
        })}
      </XStack>
    </YStack>
  );
}

interface IPerpSettingsPopoverContentProps {
  closePopover: () => void;
  showFeeTierEntry?: boolean;
}

function PerpSettingsPopoverContent({
  closePopover,
  showFeeTierEntry = false,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();

  return (
    <YStack py="$3" px="$2">
      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perp_setting_title,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.perp_setting_desc,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.skipOrderConfirm}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              skipOrderConfirm: value,
            }));
          }}
        />
      </ListItem>

      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perps_settings_shows_buy_sell_title,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.showTradeMarks ?? true}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              showTradeMarks: value,
            }));
          }}
        />
      </ListItem>

      <ListItem
        mx="$0"
        px="$2.5"
        titleProps={{ size: '$bodyMdMedium' }}
        subtitleProps={{ size: '$bodySm' }}
        title={intl.formatMessage({
          id: ETranslations.perps_settings_shows_positions_title,
        })}
        cursor="default"
      >
        <Switch
          size={ESwitchSize.small}
          value={perpsCustomSettings.showChartLines ?? true}
          onChange={(value) => {
            setPerpsCustomSettings((prev) => ({
              ...prev,
              showChartLines: value,
            }));
          }}
        />
      </ListItem>

      {showFeeTierEntry ? (
        <ListItem
          mx="$0"
          px="$2.5"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perps_fee_tiers,
          })}
          onPress={() => {
            closePopover();
            showPerpFeeTierDialog();
          }}
          cursor="default"
        >
          <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
        </ListItem>
      ) : null}

      <DevAbstractionModeSelector />
    </YStack>
  );
}

export interface IPerpSettingsPopoverProps {
  renderTrigger: ReactNode;
  showFeeTierEntry?: boolean;
}

export function PerpSettingsPopover({
  renderTrigger,
  showFeeTierEntry = false,
}: IPerpSettingsPopoverProps) {
  const intl = useIntl();

  return (
    <PerpsProviderMirror>
      <Popover
        title={intl.formatMessage({
          id: ETranslations.address_book_menu_title,
        })}
        renderTrigger={renderTrigger}
        renderContent={({ closePopover }) => (
          <PerpSettingsPopoverContent
            closePopover={closePopover}
            showFeeTierEntry={showFeeTierEntry}
          />
        )}
        floatingPanelProps={{
          width: 360,
        }}
      />
    </PerpsProviderMirror>
  );
}
