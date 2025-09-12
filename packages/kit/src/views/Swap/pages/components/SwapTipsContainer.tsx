import {
  Icon,
  IconButton,
  Image,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSwapTipsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const SwapTipsContainer = () => {
  const [swapTips, setSwapTips] = useSwapTipsAtom();
  const { gtSm } = useMedia();

  if (!swapTips) {
    return null;
  }

  const handleClose = async () => {
    try {
      setSwapTips(undefined);
      await backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
        swapTips.tipsId,
      );
    } catch (error) {
      setSwapTips(swapTips);
    }
  };

  return (
    <YStack flex={1} pt="$0.5">
      <XStack
        flex={1}
        gap="$4"
        alignItems="center"
        p="$4"
        pr="$10"
        bg="$bg"
        $lg={{
          gap: '$3',
          py: '$3',
        }}
        borderRadius="$2"
        borderWidth={1}
        borderColor="$borderSubdued"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        $platform-native={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0.5 },
          shadowOpacity: 0.2,
          shadowRadius: 0.5,
        }}
        $platform-android={{ elevation: 0.5 }}
        $platform-web={{
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        }}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineOffset: -2,
        }}
        onPress={
          swapTips.detailLink
            ? () => openUrlExternal(swapTips.detailLink ?? '')
            : undefined
        }
        pointerEvents="box-none"
      >
        {swapTips.iconImage ? (
          <Image
            size="$12"
            borderRadius="$1"
            borderCurve="continuous"
            source={{ uri: swapTips.iconImage }}
            fallback={
              <Image.Fallback
                w="100%"
                h="100%"
                borderRadius="$2.5"
                bg="$bgStrong"
                justifyContent="center"
                alignItems="center"
              >
                <Icon name="ImageSquareWavesOutline" color="$iconDisabled" />
              </Image.Fallback>
            }
          />
        ) : null}
        {gtSm ? (
          <YStack gap="$0.5" flex={1}>
            <SizableText size="$bodyLgMedium" numberOfLines={2}>
              {swapTips.title}
            </SizableText>
            {swapTips.description ? (
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              >
                {swapTips.description}
              </SizableText>
            ) : null}
          </YStack>
        ) : (
          <SizableText size="$bodyMdMedium" flex={1} numberOfLines={2}>
            {swapTips.title}
            {swapTips.description ? (
              <>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {' '}
                  -{' '}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {swapTips.description}
                </SizableText>
              </>
            ) : null}
          </SizableText>
        )}

        {swapTips.userCanClose ? (
          <IconButton
            position="absolute"
            top="$2.5"
            right="$2.5"
            size="small"
            variant="tertiary"
            onPress={handleClose}
            icon="CrossedSmallOutline"
          />
        ) : null}
      </XStack>
    </YStack>
  );
};

export default SwapTipsContainer;
