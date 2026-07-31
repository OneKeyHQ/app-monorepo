import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Dialog, Divider, SizableText, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

type IProtocolTips = NonNullable<IStakeEarnDetail['protocolTips']>;
type IProtocolTipItem = IProtocolTips['tips'][number];

// 外显规则 (OK-58972)：单条直显；多条优先 showDefault=true 的第一条，
// 均未标记时回落数组第一条。
function pickInlineTip(tips: IProtocolTipItem[]): IProtocolTipItem {
  return tips.find((tip) => tip.showDefault) ?? tips[0];
}

function ProtocolTipRow({ tip }: { tip: IProtocolTipItem }) {
  return (
    <YStack gap="$1">
      <EarnText text={tip.title} size="$bodyMdMedium" />
      <EarnText text={tip.description} size="$bodyMd" color="$textSubdued" />
    </YStack>
  );
}

// FIXME: Replace with product-approved i18n key once available (设计稿文案
// "Protocol tips"，figma 24951-53676)。
const PROTOCOL_TIPS_HEADER = 'Protocol tips';

export function ProtocolTipsSection({
  protocolTips,
}: {
  protocolTips?: IProtocolTips;
}) {
  const intl = useIntl();
  const tips = useMemo(
    () =>
      (protocolTips?.tips ?? []).filter(
        (tip) => tip.title?.text && tip.description?.text,
      ),
    [protocolTips?.tips],
  );

  const handleViewAll = useCallback(() => {
    Dialog.show({
      title: PROTOCOL_TIPS_HEADER,
      showFooter: false,
      renderContent: (
        <YStack gap="$4" pb="$2">
          {tips.map((tip, index) => (
            <YStack key={index} gap="$4">
              {index > 0 ? <Divider /> : null}
              <ProtocolTipRow tip={tip} />
            </YStack>
          ))}
        </YStack>
      ),
    });
  }, [tips]);

  if (tips.length === 0) {
    return null;
  }

  const inlineTip = pickInlineTip(tips);
  const hasMore = tips.length > 1;

  // 图表下方卡片 (设计稿)：白底描边圆角，仅标题条为浅灰背景，
  // 内容区白底：外显 tip + 居中蓝色 View all。
  // 间距：所在容器无 gap，上方补 $4；下方是外层 section gap $8，
  // 用 -$2 收窄到 24px，与设计稿卡片下间距一致
  return (
    <YStack
      mt="$4"
      mb="$-2"
      bg="$bg"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <YStack bg="$bgSubdued" px="$4" py="$2">
        <SizableText size="$bodyMdMedium" textAlign="center">
          {PROTOCOL_TIPS_HEADER}
        </SizableText>
      </YStack>
      <YStack px="$4" py="$3" gap="$2">
        <YStack gap="$0.5">
          <SizableText size="$bodyMdMedium" numberOfLines={1}>
            {inlineTip.title.text}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
            {inlineTip.description.text}
          </SizableText>
        </YStack>
        {hasMore ? (
          <SizableText
            testID="earn-protocol-tips-view-all"
            role="button"
            size="$bodyMdMedium"
            color="$textInfo"
            textAlign="center"
            cursor="pointer"
            userSelect="none"
            pressStyle={{ opacity: 0.7 }}
            onPress={handleViewAll}
          >
            {intl.formatMessage({ id: ETranslations.tray_view_all })}
          </SizableText>
        ) : null}
      </YStack>
    </YStack>
  );
}
