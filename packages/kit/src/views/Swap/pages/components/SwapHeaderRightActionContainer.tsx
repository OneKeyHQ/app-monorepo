import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
  Divider,
  EPageType,
  Icon,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import {
  swapSlippageDecimal,
  swapSlippageWillAheadMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapSlippagePercentageModeInfo } from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

const SwapSettingsCommonItem = ({
  value,
  onChange,
  title,
  content,
  badgeContent,
}: {
  title: string;
  content: string;
  badgeContent?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <XStack justifyContent="space-between" alignItems="center">
    <YStack flex={1} gap="$0.5">
      <XStack alignItems="center" gap="$1.5">
        <SizableText size="$bodyLgMedium">{title}</SizableText>
        {badgeContent ? (
          <Badge badgeSize="sm" badgeType="success">
            {badgeContent}
          </Badge>
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" color="$textSubdued" width="95%">
        {content}
      </SizableText>
    </YStack>
    <Switch value={value} onChange={onChange} />
  </XStack>
);

const SwapSettingsSlippageItem = ({
  title,
  rightTrigger,
}: {
  title: string;
  rightTrigger: React.ReactNode;
}) => (
  <XStack justifyContent="space-between" alignItems="center">
    <XStack>
      <SizableText userSelect="none" mr="$1" size="$bodyLgMedium" color="$text">
        {title}
      </SizableText>
    </XStack>
    <XStack gap="$2">{rightTrigger}</XStack>
  </XStack>
);

const SwapSettingsDialogContent = ({
  onSlippageHandleClick,
}: {
  onSlippageHandleClick: () => void;
}) => {
  const intl = useIntl();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [{ swapBatchApproveAndSwap, swapEnableRecipientAddress }, setSettings] =
    useSettingsPersistAtom();
  const [, setNoPersistSettings] = useSettingsAtom();
  const displaySlippage = useMemo(
    () =>
      new BigNumber(slippageItem.value)
        .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
        .toFixed(),
    [slippageItem.value],
  );
  const slippageDisplayValue = useMemo(
    () =>
      slippageItem.key === ESwapSlippageSegmentKey.AUTO
        ? intl.formatMessage({
            id: ETranslations.global_auto,
          })
        : intl.formatMessage(
            {
              id: ETranslations.swap_page_provider_custom,
            },
            { number: displaySlippage },
          ),
    [displaySlippage, intl, slippageItem.key],
  );
  const valueComponent = useMemo(
    () => (
      <SizableText
        size="$bodyMd"
        ml="$0.5"
        color={
          slippageItem.value > swapSlippageWillAheadMinValue
            ? '$textCritical'
            : '$textSubdued'
        }
      >
        {slippageDisplayValue}
      </SizableText>
    ),
    [slippageDisplayValue, slippageItem.value],
  );
  const rightTrigger = useMemo(
    () => (
      <XStack
        userSelect="none"
        hoverStyle={{
          opacity: 0.5,
        }}
        alignItems="center"
        onPress={onSlippageHandleClick}
        cursor="pointer"
      >
        {slippageItem.key === ESwapSlippageSegmentKey.AUTO ? (
          <Icon name="Ai3StarOutline" size="$5" color="$iconSuccess" />
        ) : null}
        {valueComponent}
        <Icon
          name="ChevronRightSmallOutline"
          mr="$-1"
          size="$5"
          color="$iconSubdued"
        />
      </XStack>
    ),
    [onSlippageHandleClick, slippageItem.key, valueComponent],
  );
  return (
    <YStack gap="$5">
      <SwapSettingsSlippageItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_provider_slippage_tolerance,
        })}
        rightTrigger={rightTrigger}
      />
      <Divider />
      <SwapSettingsCommonItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_settings_simple_mode,
        })}
        content={intl.formatMessage({
          id: ETranslations.swap_page_settings_simple_mode_content,
        })}
        badgeContent="Beta"
        value={swapBatchApproveAndSwap}
        onChange={(v) => {
          setSettings((s) => ({
            ...s,
            swapBatchApproveAndSwap: v,
          }));
        }}
      />
      <SwapSettingsCommonItem
        title={intl.formatMessage({
          id: ETranslations.swap_page_settings_recipient_title,
        })}
        content={intl.formatMessage({
          id: ETranslations.swap_page_settings_recipient_content,
        })}
        value={swapEnableRecipientAddress}
        onChange={(v) => {
          setSettings((s) => ({
            ...s,
            swapEnableRecipientAddress: v,
          }));
          if (!v) {
            setNoPersistSettings((s) => ({
              ...s,
              swapToAnotherAccountSwitchOn: false,
            }));
          }
        }}
      />
    </YStack>
  );
};

const SwapHeaderRightActionContainer = ({
  pageType,
  onSlippageHandleClick,
}: {
  pageType?: EPageType;
  onSlippageHandleClick: () => void;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const intl = useIntl();
  const swapPendingStatusList = useMemo(
    () =>
      swapHistoryPendingList.filter(
        (i) =>
          i.status === ESwapTxHistoryStatus.PENDING ||
          i.status === ESwapTxHistoryStatus.CANCELING,
      ),
    [swapHistoryPendingList],
  );
  const onOpenHistoryListModal = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
    });
  }, [navigation]);

  const onOpenSwapSettings = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_page_settings,
      }),
      renderContent: (
        <SwapProviderMirror
          storeName={
            pageType === EPageType.modal
              ? EJotaiContextStoreNames.swapModal
              : EJotaiContextStoreNames.swap
          }
        >
          <SwapSettingsDialogContent
            onSlippageHandleClick={onSlippageHandleClick}
          />
        </SwapProviderMirror>
      ),
      showConfirmButton: false,
      showCancelButton: false,
      showFooter: false,
    });
  }, [intl, onSlippageHandleClick, pageType]);

  return (
    <HeaderButtonGroup>
      {swapPendingStatusList.length > 0 ? (
        <Badge badgeSize="lg" badgeType="info" onPress={onOpenHistoryListModal}>
          <Stack borderRadius="$full" p={3} bg="$borderInfo">
            <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
          </Stack>
          <Badge.Text cursor="pointer" pl="$2">{`${
            swapPendingStatusList.length
          } ${intl.formatMessage({
            id: ETranslations.swap_history_detail_status_pending,
          })} `}</Badge.Text>
        </Badge>
      ) : (
        <HeaderIconButton
          icon="ClockTimeHistoryOutline"
          onPress={onOpenHistoryListModal}
          iconProps={{ size: 24 }}
          size="medium"
        />
      )}
      <HeaderIconButton
        icon="SettingsOutline"
        onPress={onOpenSwapSettings}
        iconProps={{ size: 24 }}
        size="medium"
      />
    </HeaderButtonGroup>
  );
};

export default SwapHeaderRightActionContainer;
