import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useSharedValue } from 'react-native-reanimated';

import { SizableText, Tabs, XStack } from '@onekeyhq/components';
import type { IAppNavigation } from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type {
  IEarnHistoryActionIcon,
  IEarnSelectField,
  IEarnTokenInfo,
  IProtocolInfo,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { HeaderRight } from './HeaderRight';
import { StakeSection } from './StakeSection';
import { WithdrawSection } from './WithdrawSection';

interface INormalManageContentProps {
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  tokenInfo?: IEarnTokenInfo;
  protocolInfo?: IProtocolInfo;
  earnAccount?: {
    accountId: string;
  };
  depositDisabled: boolean;
  withdrawDisabled: boolean;
  stakeBeforeFooter: React.ReactElement | null;
  withdrawBeforeFooter: React.ReactElement | null;
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: (params?: { filterType?: string }) => void;
  indicatorAccountId?: string;
  stakeTag?: IStakeTag;
  onIndicatorRefresh?: () => void;
  onRefreshPendingRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  onSuccess?: () => void;
  defaultTab?: 'deposit' | 'withdraw';
  onTabChange?: (tab: 'deposit' | 'withdraw') => void;
  isInModalContext: boolean;
  appNavigation: IAppNavigation;
  showApyDetail?: boolean;
  fallbackTokenImageUri?: string;
  ongoingValidator?: IEarnSelectField;
}

export function NormalManageContent({
  networkId,
  symbol,
  provider,
  vault,
  tokenInfo,
  protocolInfo,
  earnAccount,
  depositDisabled,
  withdrawDisabled,
  stakeBeforeFooter,
  withdrawBeforeFooter,
  historyAction,
  onHistory,
  indicatorAccountId,
  stakeTag,
  onIndicatorRefresh,
  onRefreshPendingRef,
  onSuccess,
  defaultTab,
  onTabChange,
  isInModalContext,
  appNavigation,
  showApyDetail,
  fallbackTokenImageUri,
  ongoingValidator,
}: INormalManageContentProps) {
  const intl = useIntl();

  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    if (defaultTab === 'withdraw') return 1;
    return 0;
  });

  useEffect(() => {
    if (defaultTab === 'withdraw') {
      setSelectedTabIndex(1);
    } else if (defaultTab === 'deposit') {
      setSelectedTabIndex(0);
    }
  }, [defaultTab]);

  const tabData = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.earn_deposit }),
        type: EStakingActionType.Deposit,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_withdraw }),
        type: EStakingActionType.Withdraw,
      },
    ],
    [intl],
  );

  const tabNames = useMemo(() => tabData.map((item) => item.title), [tabData]);

  const initialTabName = useMemo(() => {
    if (defaultTab === 'withdraw') return tabNames[1];
    return tabNames[0];
  }, [defaultTab, tabNames]);

  const focusedTab = useSharedValue(initialTabName);

  const isWithdrawOrder = useMemo(() => {
    return (
      protocolInfo?.withdrawAction?.type === EStakingActionType.WithdrawOrder
    );
  }, [protocolInfo?.withdrawAction?.type]);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        if (index === 1 && isWithdrawOrder) {
          const withdrawParams = {
            accountId: earnAccount?.accountId || '',
            networkId,
            protocolInfo,
            tokenInfo,
            symbol,
            provider,
            onSuccess,
            isInModalContext,
          };

          if (isInModalContext) {
            appNavigation.push(
              EModalStakingRoutes.WithdrawOptions,
              withdrawParams,
            );
          } else {
            appNavigation.pushModal(EModalRoutes.StakingModal, {
              screen: EModalStakingRoutes.WithdrawOptions,
              params: withdrawParams,
            });
          }
          return;
        }

        focusedTab.value = name;
        setSelectedTabIndex(index);

        const newTab = index === 0 ? 'deposit' : 'withdraw';
        onTabChange?.(newTab);
      }
    },
    [
      isWithdrawOrder,
      earnAccount?.accountId,
      focusedTab,
      tabData,
      protocolInfo,
      appNavigation,
      networkId,
      tokenInfo,
      symbol,
      provider,
      onTabChange,
      isInModalContext,
      onSuccess,
    ],
  );

  return (
    <>
      <XStack jc="space-between" px="$5">
        <Tabs.TabBar
          divider={false}
          onTabPress={handleTabChange}
          tabNames={tabNames}
          focusedTab={focusedTab}
          renderItem={({ name, isFocused }) => (
            <XStack
              px="$2"
              py="$1.5"
              mr="$1"
              bg={isFocused ? '$bgActive' : '$bg'}
              borderRadius="$2"
              borderCurve="continuous"
              hoverStyle={
                !isFocused
                  ? {
                      bg: '$bgHover',
                    }
                  : null
              }
              onPress={() => handleTabChange(name)}
            >
              <SizableText
                size="$headingMd"
                color={isFocused ? '$text' : '$textSubdued'}
                letterSpacing={-0.15}
              >
                {name}
              </SizableText>
            </XStack>
          )}
        />
        <HeaderRight
          accountId={indicatorAccountId || earnAccount?.accountId}
          networkId={networkId}
          stakeTag={stakeTag || protocolInfo?.stakeTag}
          historyAction={historyAction}
          onHistory={onHistory}
          onRefresh={onIndicatorRefresh}
          onRefreshPending={(refreshFn) => {
            if (onRefreshPendingRef) {
              onRefreshPendingRef.current = refreshFn;
            }
          }}
        />
      </XStack>
      {selectedTabIndex === 0 ? (
        <StakeSection
          accountId={earnAccount?.accountId || ''}
          networkId={networkId}
          tokenInfo={tokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={depositDisabled}
          onSuccess={onSuccess}
          beforeFooter={stakeBeforeFooter}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
          fallbackTokenImageUri={fallbackTokenImageUri}
          ongoingValidator={ongoingValidator}
        />
      ) : null}
      {selectedTabIndex === 1 ? (
        <WithdrawSection
          accountId={earnAccount?.accountId || ''}
          networkId={networkId}
          tokenInfo={tokenInfo}
          protocolInfo={protocolInfo}
          isDisabled={withdrawDisabled}
          onSuccess={onSuccess}
          beforeFooter={withdrawBeforeFooter}
          showApyDetail={showApyDetail}
          isInModalContext={isInModalContext}
          fallbackTokenImageUri={fallbackTokenImageUri}
        />
      ) : null}
    </>
  );
}
