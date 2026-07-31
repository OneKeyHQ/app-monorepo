import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Divider,
  SizableText,
  YStack,
} from '@onekeyhq/components';
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
      title: tips[0] ? pickInlineTip(tips).title.text : '',
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

  return (
    <YStack
      p="$4"
      gap="$1"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
    >
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {inlineTip.title.text}
      </SizableText>
      <EarnText
        text={inlineTip.description}
        size="$bodyMd"
        color="$textSubdued"
      />
      {hasMore ? (
        <Button
          testID="earn-protocol-tips-view-all"
          size="small"
          variant="tertiary"
          alignSelf="flex-start"
          mt="$1"
          onPress={handleViewAll}
        >
          {intl.formatMessage({ id: ETranslations.tray_view_all })}
        </Button>
      ) : null}
    </YStack>
  );
}
