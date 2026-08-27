import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { styled } from '@tamagui/core';
import { useIntl } from 'react-intl';
import { useReducedMotion } from 'react-native-reanimated';

import {
  AnimatePresence,
  Dialog,
  ESwitchSize,
  Icon,
  Popover,
  SizableText,
  Stack,
  Switch,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { WebAccountPanelHeader } from '@onekeyhq/kit/src/components/TabPageHeader/components/WebAccountPanel/atoms/WebAccountPanelHeader';
import {
  usePerpsAbstractionModeAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsCustomSettingsAtom,
  usePerpsLayoutStateAtom,
  usePerpsSpotDustingAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

import { useShowGuide } from '../hooks/useShowGuide';
import { resetPerpDesktopLeftSplit } from '../layouts/perpLayoutUtils';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { PerpTestIDs } from '../testIDs';

import { PerpGuideContent } from './Guide/PerpGuideContent';
import {
  PerpLayoutSettingsEntry,
  showPerpLayoutSettingsDialog,
} from './PerpLayoutSettings';
import { PerpsActivityCenterContent } from './PerpsActivityCenterAction';

import type { LayoutChangeEvent } from 'react-native';

type IPerpSettingsView = 'settings' | 'activityCenter' | 'guide';

const SETTINGS_PANEL_WIDTH = 360;
const ANIMATE_ONLY_HEIGHT: string[] = ['height'];

const AnimatedSettingsPanelView = styled(Stack, {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  variants: {
    going: {
      ':number': (going: number) => ({
        enterStyle: {
          x: going >= 0 ? SETTINGS_PANEL_WIDTH : -SETTINGS_PANEL_WIDTH,
        },
        exitStyle: {
          x: going >= 0 ? -SETTINGS_PANEL_WIDTH : SETTINGS_PANEL_WIDTH,
        },
      }),
    },
  } as const,
});

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
      mx="$3"
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
  closePopover: () => void | Promise<void>;
  onOpenActivityCenter?: () => void;
  onOpenGuide?: () => void;
  showActivityCenterEntry?: boolean;
  showChartPositionSetting?: boolean;
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
      px="$3"
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

function PerpSettingsMainContent({
  showActivityCenterEntry = false,
  showChartPositionSetting = false,
  showGuideEntry = false,
  onOpenActivityCenter,
  onOpenLayoutSettings,
  onOpenGuide,
}: Omit<IPerpSettingsPopoverContentProps, 'closePopover'> & {
  onOpenActivityCenter: () => void;
  onOpenLayoutSettings: () => void;
  onOpenGuide: () => void;
}) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [, setPerpsLayoutState] = usePerpsLayoutStateAtom();
  const intl = useIntl();
  const { gtMd } = useMedia();
  // The resizable split layout is used by every non-native large-screen target.
  const showResetLayoutEntry = gtMd && !platformEnv.isNative;

  const handleResetLayout = useCallback(() => {
    setPerpsLayoutState(resetPerpDesktopLeftSplit);
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.perps_layout_reset__msg,
      }),
    });
  }, [intl, setPerpsLayoutState]);

  return (
    <YStack py="$3" px="$2">
      <ListItem
        mx="$0"
        px="$3"
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
        px="$3"
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
        px="$3"
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

      {showChartPositionSetting ? (
        <PerpLayoutSettingsEntry
          onPress={onOpenLayoutSettings}
          showFeatureDot={platformEnv.isNative || !gtMd}
        />
      ) : null}

      {showActivityCenterEntry ? (
        <ListItem
          testID={PerpTestIDs.ActivityCenterButton}
          mx="$0"
          px="$3"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perps_activity_hub,
          })}
          onPress={onOpenActivityCenter}
          cursor="default"
        >
          <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
        </ListItem>
      ) : null}

      {showGuideEntry ? (
        <ListItem
          testID={PerpTestIDs.GuideButton}
          mx="$0"
          px="$3"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perp_guide_title,
          })}
          onPress={onOpenGuide}
          cursor="default"
        >
          <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
        </ListItem>
      ) : null}

      {showResetLayoutEntry ? (
        <ListItem
          testID={PerpTestIDs.ResetLayoutButton}
          mx="$0"
          px="$3"
          titleProps={{ size: '$bodyMdMedium' }}
          title={intl.formatMessage({
            id: ETranslations.perps_back_to_default_layout__action,
          })}
          onPress={handleResetLayout}
          cursor="default"
        />
      ) : null}

      <DevAbstractionModeSelector />
    </YStack>
  );
}

function PerpSettingsPopoverContent({
  closePopover,
  onOpenActivityCenter,
  onOpenGuide,
  showActivityCenterEntry = false,
  showChartPositionSetting = false,
  showGuideEntry = false,
}: IPerpSettingsPopoverContentProps) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const { showGuide } = useShowGuide();
  const [view, setView] = useState<IPerpSettingsView>('settings');
  const [going, setGoing] = useState(1);
  const [navSeq, setNavSeq] = useState(0);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );
  const [heightReady, setHeightReady] = useState(false);
  const navSeqRef = useRef(navSeq);
  navSeqRef.current = navSeq;

  const navigate = useCallback((nextView: IPerpSettingsView) => {
    setGoing(1);
    setNavSeq((seq) => seq + 1);
    setView(nextView);
  }, []);

  const back = useCallback(() => {
    setGoing(-1);
    setNavSeq((seq) => seq + 1);
    setView('settings');
  }, []);

  const handleViewLayout = useCallback((seq: number, height: number) => {
    if (height > 0 && navSeqRef.current === seq) {
      setContentHeight(height);
    }
  }, []);

  useEffect(() => {
    if (contentHeight !== undefined && !heightReady) {
      setHeightReady(true);
    }
  }, [contentHeight, heightReady]);

  const handleOpenActivityCenter = useCallback(() => {
    if (onOpenActivityCenter) {
      void Promise.resolve(closePopover()).then(onOpenActivityCenter);
      return;
    }
    navigate('activityCenter');
  }, [closePopover, navigate, onOpenActivityCenter]);

  const handleOpenLayoutSettings = useCallback(() => {
    void Promise.resolve(closePopover()).then(() => {
      showPerpLayoutSettingsDialog({
        title: intl.formatMessage({
          id: ETranslations.perps_layout_settings__title,
        }),
      });
    });
  }, [closePopover, intl]);

  const handleOpenGuide = useCallback(() => {
    if (onOpenGuide) {
      void Promise.resolve(closePopover()).then(onOpenGuide);
      return;
    }
    if (showActivityCenterEntry) {
      navigate('guide');
      return;
    }
    void closePopover();
    showGuide();
  }, [closePopover, navigate, onOpenGuide, showActivityCenterEntry, showGuide]);

  const rendered = useMemo(() => {
    if (view === 'settings') {
      return (
        <PerpSettingsMainContent
          showActivityCenterEntry={showActivityCenterEntry}
          showChartPositionSetting={showChartPositionSetting}
          showGuideEntry={showGuideEntry}
          onOpenActivityCenter={handleOpenActivityCenter}
          onOpenLayoutSettings={handleOpenLayoutSettings}
          onOpenGuide={handleOpenGuide}
        />
      );
    }

    const backLabel = intl.formatMessage({
      id: ETranslations.global_back,
    });
    if (view === 'activityCenter') {
      return (
        <YStack w="100%">
          <WebAccountPanelHeader title={backLabel} onBack={back} />
          <PerpsActivityCenterContent
            copyAsUrl
            closePopover={closePopover}
            showTitle={false}
          />
        </YStack>
      );
    }

    return (
      <YStack w="100%">
        <WebAccountPanelHeader title={backLabel} onBack={back} />
        <YStack h={640}>
          <PerpGuideContent onClose={closePopover} />
        </YStack>
      </YStack>
    );
  }, [
    back,
    closePopover,
    handleOpenActivityCenter,
    handleOpenLayoutSettings,
    handleOpenGuide,
    intl,
    showActivityCenterEntry,
    showChartPositionSetting,
    showGuideEntry,
    view,
  ]);

  const animation = reducedMotion || !heightReady ? '0ms' : 'smooth';
  const presenceCustom = useMemo(() => ({ going }), [going]);

  return (
    <Stack
      position="relative"
      width="100%"
      overflow="hidden"
      height={contentHeight}
      animation={animation}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      <AnimatePresence custom={presenceCustom} initial={false}>
        <AnimatedSettingsPanelView
          key={navSeq}
          going={going}
          animation={reducedMotion ? '0ms' : 'smooth'}
          onLayout={(event: LayoutChangeEvent) =>
            handleViewLayout(navSeq, event.nativeEvent.layout.height)
          }
        >
          {rendered}
        </AnimatedSettingsPanelView>
      </AnimatePresence>
    </Stack>
  );
}

export interface IPerpSettingsPopoverProps {
  renderTrigger: ReactNode;
  showActivityCenterEntry?: boolean;
  showChartPositionSetting?: boolean;
  showGuideEntry?: boolean;
}

export function showPerpSettingsDialog({
  title,
  onOpenActivityCenter,
  onOpenGuide,
  showActivityCenterEntry = false,
  showChartPositionSetting = false,
  showGuideEntry = false,
}: {
  title: string;
  onOpenActivityCenter?: () => void;
  onOpenGuide?: () => void;
  showActivityCenterEntry?: boolean;
  showChartPositionSetting?: boolean;
  showGuideEntry?: boolean;
}) {
  const dialogInstanceRef: {
    current: ReturnType<typeof Dialog.show> | undefined;
  } = {
    current: undefined,
  };
  const closeDialog = () => {
    return dialogInstanceRef.current?.close();
  };

  const dialogInstance = Dialog.show({
    title,
    showFooter: false,
    contentContainerProps: {
      p: '$0',
    },
    floatingPanelProps: {
      overflow: 'hidden',
    },
    renderContent: (
      <PerpsProviderMirror>
        <PerpSettingsPopoverContent
          closePopover={closeDialog}
          onOpenActivityCenter={onOpenActivityCenter}
          onOpenGuide={onOpenGuide}
          showActivityCenterEntry={showActivityCenterEntry}
          showChartPositionSetting={showChartPositionSetting}
          showGuideEntry={showGuideEntry}
        />
      </PerpsProviderMirror>
    ),
  });
  dialogInstanceRef.current = dialogInstance;

  return dialogInstance;
}

export function PerpSettingsPopover({
  renderTrigger,
  showActivityCenterEntry = false,
  showChartPositionSetting = false,
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
            showActivityCenterEntry={showActivityCenterEntry}
            showChartPositionSetting={showChartPositionSetting}
            showGuideEntry={showGuideEntry}
          />
        )}
        floatingPanelProps={{
          width: SETTINGS_PANEL_WIDTH,
          maxWidth: SETTINGS_PANEL_WIDTH,
          overflow: 'hidden',
          style: { transformOrigin: 'top right' },
        }}
      />
    </PerpsProviderMirror>
  );
}
