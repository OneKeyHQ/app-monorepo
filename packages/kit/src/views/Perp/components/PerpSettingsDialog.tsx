import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  usePerpsActiveAccountStatusAtom,
  usePerpsCustomSettingsAtom,
  usePerpsSpotDustingAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { useShowGuide } from '../hooks/useShowGuide';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

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
  showGuideEntry?: boolean;
}

function SpotDustingOptOutSetting() {
  const intl = useIntl();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [activeAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [spotDusting] = usePerpsSpotDustingAtom();
  const [pendingStatus, setPendingStatus] = useState<
    | {
        accountAddress: string;
        enabled: boolean;
      }
    | undefined
  >();

  const activeAccountAddress = activeAccount.accountAddress?.toLowerCase();
  const activeAccountAddressRef = useRef(activeAccountAddress);
  activeAccountAddressRef.current = activeAccountAddress;
  const statusMatchesActiveAccount =
    Boolean(activeAccountAddress) &&
    spotDusting?.accountAddress?.toLowerCase() === activeAccountAddress;
  const serverEnabled = statusMatchesActiveAccount
    ? spotDusting?.optOut !== true
    : false;
  const pendingEnabled =
    pendingStatus && pendingStatus.accountAddress === activeAccountAddress
      ? pendingStatus.enabled
      : undefined;
  const enabled = pendingEnabled ?? serverEnabled;
  const canToggle =
    activeAccountStatus.canTrade === true &&
    statusMatchesActiveAccount &&
    pendingEnabled === undefined;

  useEffect(() => {
    setPendingStatus((prev) =>
      prev?.accountAddress === activeAccountAddress ? prev : undefined,
    );
  }, [activeAccountAddress]);

  const copy = useMemo(
    () => ({
      title: intl.formatMessage({
        id: ETranslations.perp_spot_dusting__title,
      }),
      loadingSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_loading__desc,
      }),
      disabledSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_enable_trading_required__desc,
      }),
      enabledSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_on__desc,
      }),
      disabledStateSubtitle: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_off__desc,
      }),
      loadingToast: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_loading__msg,
      }),
      disabledToast: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_enable_trading_required__msg,
      }),
      enabling: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turning_on__msg,
      }),
      disabling: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turning_off__msg,
      }),
      enabled: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turned_on__msg,
      }),
      disabled: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_turned_off__msg,
      }),
      failed: intl.formatMessage({
        id: ETranslations.perp_spot_dusting_update_failed__msg,
      }),
    }),
    [intl],
  );

  const subtitle = useMemo(() => {
    if (!statusMatchesActiveAccount) {
      return copy.loadingSubtitle;
    }
    if (activeAccountStatus.canTrade !== true) {
      return copy.disabledSubtitle;
    }
    return enabled ? copy.enabledSubtitle : copy.disabledStateSubtitle;
  }, [
    activeAccountStatus.canTrade,
    copy.disabledStateSubtitle,
    copy.disabledSubtitle,
    copy.enabledSubtitle,
    copy.loadingSubtitle,
    enabled,
    statusMatchesActiveAccount,
  ]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      const requestAccountAddress = activeAccountAddressRef.current;
      if (!requestAccountAddress) {
        return;
      }
      if (!statusMatchesActiveAccount) {
        Toast.error({
          title: copy.loadingToast,
        });
        return;
      }

      if (activeAccountStatus.canTrade !== true) {
        Toast.error({
          title: copy.disabledToast,
        });
        return;
      }

      setPendingStatus({
        accountAddress: requestAccountAddress,
        enabled: value,
      });
      const loadingToast = Toast.loading({
        title: value ? copy.enabling : copy.disabling,
        duration: Infinity,
      });
      try {
        await backgroundApiProxy.serviceHyperliquidExchange.setSpotDustingOptOut(
          { optOut: !value },
        );
        loadingToast?.close();
        if (activeAccountAddressRef.current === requestAccountAddress) {
          Toast.success({
            title: value ? copy.enabled : copy.disabled,
          });
        }
      } catch (error) {
        loadingToast?.close();
        if (activeAccountAddressRef.current === requestAccountAddress) {
          Toast.error({
            title: (error as Error)?.message || copy.failed,
          });
        }
      } finally {
        setPendingStatus((prev) =>
          prev?.accountAddress === requestAccountAddress ? undefined : prev,
        );
      }
    },
    [
      activeAccountStatus.canTrade,
      copy.disabledToast,
      copy.disabling,
      copy.disabled,
      copy.enabled,
      copy.enabling,
      copy.failed,
      copy.loadingToast,
      statusMatchesActiveAccount,
    ],
  );

  return (
    <ListItem
      mx="$0"
      px="$2.5"
      titleProps={{ size: '$bodyMdMedium' }}
      subtitleProps={{ size: '$bodySm' }}
      title={copy.title}
      subtitle={subtitle}
      cursor="default"
    >
      <Switch
        testID="perp-spot-dusting-opt-out-switch"
        size={ESwitchSize.small}
        value={enabled}
        disabled={!canToggle}
        onChange={handleToggle}
      />
    </ListItem>
  );
}

function PerpSettingsPopoverContent({
  closePopover,
  showGuideEntry = false,
}: IPerpSettingsPopoverContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const intl = useIntl();
  const { showGuide } = useShowGuide();

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
          testID="perp-intl-switch"
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

      <SpotDustingOptOutSetting />

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
          testID="perp-switch"
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
          testID="perp-switch"
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

      {showGuideEntry ? (
        <ListItem
          mx="$0"
          px="$2.5"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perp_guide_title,
          })}
          onPress={() => {
            closePopover();
            showGuide();
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
  showGuideEntry?: boolean;
}

export function PerpSettingsPopover({
  renderTrigger,
  showGuideEntry = false,
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
            showGuideEntry={showGuideEntry}
          />
        )}
        floatingPanelProps={{
          width: 360,
        }}
      />
    </PerpsProviderMirror>
  );
}
