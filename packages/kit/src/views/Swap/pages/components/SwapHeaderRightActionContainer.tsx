import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Badge,
  Dialog,
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
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

const SwapSettingsDialogContent = () => {
  const intl = useIntl();
  const [{ swapBatchApproveAndSwap }, setSettings] = useSettingsPersistAtom();

  return (
    <YStack gap="$5">
      <XStack justifyContent="space-between" alignItems="center">
        <YStack>
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.swap_page_settings_simple_mode,
            })}
          </SizableText>
          <SizableText size="$bodyMd">
            {intl.formatMessage({
              id: ETranslations.swap_page_settings_simple_mode_content,
            })}
          </SizableText>
        </YStack>
        <Switch
          value={swapBatchApproveAndSwap}
          onChange={(v) => {
            setSettings((s) => ({
              ...s,
              swapBatchApproveAndSwap: v,
            }));
          }}
        />
      </XStack>
    </YStack>
  );
};

const SwapHeaderRightActionContainer = () => {
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
      renderContent: <SwapSettingsDialogContent />,
      showConfirmButton: false,
      showCancelButton: false,
      showFooter: false,
    });
  }, [intl]);

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
