import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Button,
  Dialog,
  Divider,
  EPageType,
  HeightTransition,
  Icon,
  SegmentControl,
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
import { useSwapEnableRecipientAddressAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
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
  swapSlippageCustomDefaultList,
  swapSlippageItems,
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { useSwapSlippagePercentageModeInfo } from '../../hooks/useSwapState';
import { SwapProviderMirror } from '../SwapProviderMirror';

import { SlippageInput } from './SwapSlippageContentContainer';

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

const SwapSlippageCustomContent = ({
  swapSlippage,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
}) => {
  const intl = useIntl();
  const [, setSettings] = useSettingsAtom();
  const [customValueState, setCustomValueState] = useState<{
    status: ESwapSlippageCustomStatus;
    message: string;
  }>({ status: ESwapSlippageCustomStatus.NORMAL, message: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSlippageChange = useCallback(
    debounce((value: string) => {
      const valueBN = new BigNumber(value);
      if (
        valueBN.isNaN() ||
        valueBN.isNegative() ||
        valueBN.gt(swapSlippageMaxValue)
      ) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.ERROR,
          message: intl.formatMessage({
            id: ETranslations.slippage_tolerance_error_message,
          }),
        });
        return;
      }
      setSettings((s) => ({
        ...s,
        swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
        swapSlippagePercentageCustomValue: valueBN.toNumber(),
      }));
      if (valueBN.lte(swapSlippageWillFailMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_2,
            },
            { number: swapSlippageWillFailMinValue },
          ),
        });
        return;
      }
      if (valueBN.gte(swapSlippageWillAheadMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_1,
            },
            { number: swapSlippageWillAheadMinValue },
          ),
        });
        return;
      }
      setCustomValueState({
        status: ESwapSlippageCustomStatus.NORMAL,
        message: '',
      });
    }, 350),
    [],
  );
  return (
    <YStack gap="$4">
      <XStack gap="$2.5">
        <SlippageInput
          swapSlippage={swapSlippage}
          onChangeText={handleSlippageChange}
        />
        <XStack>
          {swapSlippageCustomDefaultList.map((item, index) => (
            <>
              <Button
                key={item}
                variant="secondary"
                size="medium"
                borderTopRightRadius={index !== 2 ? 0 : '$2'}
                borderBottomRightRadius={index !== 2 ? 0 : '$2'}
                borderTopLeftRadius={index !== 0 ? 0 : '$2'}
                borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
                onPress={() => {
                  setCustomValueState({
                    status: ESwapSlippageCustomStatus.NORMAL,
                    message: '',
                  });
                  setSettings((s) => ({
                    ...s,
                    swapSlippagePercentageCustomValue: item,
                    swapSlippagePercentageMode: ESwapSlippageSegmentKey.CUSTOM,
                  }));
                }}
              >{`${item}${
                index === swapSlippageCustomDefaultList.length - 1 ? '  ' : ''
              }%`}</Button>
              {index !== swapSlippageCustomDefaultList.length - 1 ? (
                <Divider vertical />
              ) : null}
            </>
          ))}
        </XStack>
      </XStack>
      {swapSlippage.key !== ESwapSlippageSegmentKey.AUTO &&
      customValueState.status !== ESwapSlippageCustomStatus.NORMAL ? (
        <SizableText
          size="$bodySmMedium"
          color={
            customValueState.status === ESwapSlippageCustomStatus.ERROR
              ? '$textCritical'
              : '$textCaution'
          }
        >
          {customValueState.message}
        </SizableText>
      ) : null}
    </YStack>
  );
};

const SwapSettingsDialogContent = () => {
  const intl = useIntl();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [swapEnableRecipientAddress, setSwapEnableRecipientAddress] =
    useSwapEnableRecipientAddressAtom();
  const [{ swapBatchApproveAndSwap }, setPersistSettings] =
    useSettingsPersistAtom();
  const [, setNoPersistSettings] = useSettingsAtom();
  const rightTrigger = useMemo(
    () => (
      <SegmentControl
        value={slippageItem.key}
        options={swapSlippageItems.map((item) => ({
          label: (
            <XStack>
              {item.key === ESwapSlippageSegmentKey.AUTO ? (
                <Icon
                  name="Ai3StarOutline"
                  size="$4.5"
                  color="$iconSuccess"
                  mr="$0.5"
                />
              ) : null}
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({
                  id:
                    item.key === ESwapSlippageSegmentKey.AUTO
                      ? ETranslations.slippage_tolerance_switch_auto
                      : ETranslations.slippage_tolerance_switch_custom,
                })}
              </SizableText>
            </XStack>
          ),
          value: item.key,
        }))}
        onChange={(value) => {
          const keyValue = value as ESwapSlippageSegmentKey;
          setNoPersistSettings((s) => ({
            ...s,
            swapSlippagePercentageMode: keyValue,
          }));
        }}
      />
    ),
    [intl, setNoPersistSettings, slippageItem.key],
  );
  return (
    <YStack gap="$5">
      <HeightTransition>
        <YStack gap="$5">
          <SwapSettingsSlippageItem
            title={intl.formatMessage({
              id: ETranslations.swap_page_provider_slippage_tolerance,
            })}
            rightTrigger={rightTrigger}
          />
          {slippageItem.key === ESwapSlippageSegmentKey.CUSTOM ? (
            <SwapSlippageCustomContent swapSlippage={slippageItem} />
          ) : null}
        </YStack>
      </HeightTransition>
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
          setPersistSettings((s) => ({
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
          setSwapEnableRecipientAddress(v);
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
}: {
  pageType?: EPageType;
}) => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [{ swapHistoryPendingList }] = useInAppNotificationAtom();
  const intl = useIntl();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const swapPendingStatusList = useMemo(
    () =>
      swapHistoryPendingList.filter(
        (i) =>
          i.status === ESwapTxHistoryStatus.PENDING ||
          i.status === ESwapTxHistoryStatus.CANCELING,
      ),
    [swapHistoryPendingList],
  );
  const slippageTitle = useMemo(() => {
    if (slippageItem.key === ESwapSlippageSegmentKey.CUSTOM) {
      return (
        <SizableText
          color={
            slippageItem.value > swapSlippageWillAheadMinValue
              ? '$textCaution'
              : '$text'
          }
          size="$bodyMdMedium"
        >{`${slippageItem.value}%`}</SizableText>
      );
    }
    return null;
  }, [slippageItem.key, slippageItem.value]);
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
          <SwapSettingsDialogContent />
        </SwapProviderMirror>
      ),
      showConfirmButton: false,
      showCancelButton: true,
      onCancelText: intl.formatMessage({
        id: ETranslations.global_close,
      }),
      showFooter: true,
    });
  }, [intl, pageType]);
  return (
    <HeaderButtonGroup>
      {slippageTitle ? (
        <XStack
          onPress={onOpenSwapSettings}
          borderRadius="$3"
          bg="$bgSubdued"
          cursor="pointer"
          px="$2"
          py="$1"
          gap="$1"
          alignItems="center"
          justifyContent="center"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
        >
          {slippageTitle}
          <Icon name="SliderHorOutline" size="$6" color="$iconSubdued" />
        </XStack>
      ) : (
        <HeaderIconButton
          icon="SliderHorOutline"
          onPress={onOpenSwapSettings}
          iconProps={{ size: 24 }}
          size="medium"
        />
      )}

      {swapPendingStatusList.length > 0 ? (
        <Stack
          m="$0.5"
          w="$5"
          h="$5"
          userSelect="none"
          borderRadius="$full"
          borderColor="$icon"
          borderWidth={1.2}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusVisibleStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          }}
          onPress={onOpenHistoryListModal}
        >
          <SizableText color="$text" size="$bodySm">
            {`${swapPendingStatusList.length}`}
          </SizableText>
        </Stack>
      ) : (
        <HeaderIconButton
          icon="ClockTimeHistoryOutline"
          onPress={onOpenHistoryListModal}
          iconProps={{ size: 24 }}
          size="medium"
        />
      )}
    </HeaderButtonGroup>
  );
};

export default SwapHeaderRightActionContainer;
