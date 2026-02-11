import {
  Alert,
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSwapTipsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';
const SwapTipsContainer = () => {
  const [swapTips, setSwapTips] = useSwapTipsAtom();
  const { gtMd } = useMedia();
  const intl = useIntl();
  if (!swapTips) {
    return null;
  }

  const handleClose = async () => {
    try {
      setSwapTips(undefined);
      await backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
        swapTips.tipsId,
      );
    } catch (_error) {
      setSwapTips(swapTips);
    }
  };

  const action = swapTips.detailLink
    ? {
        primary: intl.formatMessage({ id: ETranslations.global_learn_more }),
        onPrimaryPress: () => openUrlExternal(swapTips.detailLink ?? ''),
      }
    : undefined;

  return (
    <Alert
      type="default"
      bg="$bgInfo"
      fullBleed
      borderWidth={0}
      alignItems={gtMd ? 'center' : 'flex-start'}
      closable={!!swapTips.userCanClose}
      onClose={handleClose}
    >
      <XStack gap="$3" alignItems={gtMd ? 'center' : 'flex-start'} flex={1}>
        <Stack p="$1" bg="$bgInfo" borderRadius="$full" flexShrink={0}>
          <Icon name="InfoCircleSolid" size="$4" color="$iconInfo" />
        </Stack>
        <YStack gap="$1" flex={1}>
          {swapTips.title ? (
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {swapTips.title}
            </SizableText>
          ) : null}
          {swapTips.description ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {swapTips.description}
            </SizableText>
          ) : null}
          {!gtMd && action ? (
            <Button
              size="small"
              variant="secondary"
              onPress={action.onPrimaryPress}
              flexShrink={0}
              alignSelf="flex-start"
              px="$3"
              py="$0.5"
              mt="$0.5"
            >
              <SizableText size="$bodySm">{action.primary}</SizableText>
            </Button>
          ) : null}
        </YStack>
        {gtMd && action ? (
          <Button
            size="small"
            variant="secondary"
            onPress={action.onPrimaryPress}
            flexShrink={0}
            alignSelf="center"
            px="$3"
            py="$0.5"
          >
            <SizableText size="$bodySm">{action.primary}</SizableText>
          </Button>
        ) : null}
      </XStack>
    </Alert>
  );
};

export default SwapTipsContainer;
