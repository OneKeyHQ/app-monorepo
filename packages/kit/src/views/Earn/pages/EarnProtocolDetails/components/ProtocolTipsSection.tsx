import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Divider,
  ScrollView,
  SizableText,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

// Tips are dashboard-authored and can run long: several entries, each with a
// multi-paragraph description. Without a ceiling the dialog grows past the
// viewport on both phone and desktop and the end of the copy is unreachable.
const PROTOCOL_TIPS_DIALOG_MAX_HEIGHT = 512;

type IProtocolTips = NonNullable<IStakeEarnDetail['protocolTips']>;
type IProtocolTipItem = IProtocolTips['tips'][number];

// Inline-tip selection (OK-58972): a single tip is shown as-is; with several,
// the first one flagged showDefault wins, falling back to the first entry when
// none is flagged.
function pickInlineTip(tips: IProtocolTipItem[]): IProtocolTipItem {
  return tips.find((tip) => tip.showDefault) ?? tips[0];
}

function ProtocolTipRow({
  tip,
  onBeforeOpenUrl,
}: {
  tip: IProtocolTipItem;
  onBeforeOpenUrl?: () => Promise<void>;
}) {
  return (
    <YStack gap="$1">
      <EarnText
        text={tip.title}
        size="$bodyMdMedium"
        onBeforeOpenUrl={onBeforeOpenUrl}
      />
      <EarnText
        text={tip.description}
        size="$bodyMd"
        color="$textSubdued"
        onBeforeOpenUrl={onBeforeOpenUrl}
      />
    </YStack>
  );
}

// A tip link navigates away from this dialog, so the dialog has to go first
// (OK-61348): it lives in its own overlay while the page is pushed onto the
// navigation stack, and would otherwise still be sitting there when the user
// comes back — on native it stays stacked under the page the whole time.
// Awaited so the dismissal and the push do not animate over each other.
function ProtocolTipsDialogContent({ tips }: { tips: IProtocolTipItem[] }) {
  const dialogInstance = useDialogInstance();
  const handleBeforeOpenUrl = useCallback(async () => {
    await dialogInstance.close();
  }, [dialogInstance]);

  return (
    <ScrollView maxHeight={PROTOCOL_TIPS_DIALOG_MAX_HEIGHT} nestedScrollEnabled>
      <YStack gap="$4" pb="$2">
        {tips.map((tip, index) => (
          <YStack key={index} gap="$4">
            {index > 0 ? <Divider /> : null}
            <ProtocolTipRow tip={tip} onBeforeOpenUrl={handleBeforeOpenUrl} />
          </YStack>
        ))}
      </YStack>
    </ScrollView>
  );
}

export function ProtocolTipsSection({
  protocolTips,
}: {
  protocolTips?: IProtocolTips;
}) {
  const intl = useIntl();
  // Heading for both the card and the dialog (design: figma 24951-53676).
  const protocolTipsHeader = intl.formatMessage({
    id: ETranslations.protocol_tips__title,
  });
  const tips = useMemo(
    () =>
      (protocolTips?.tips ?? []).filter(
        (tip) => tip.title?.text && tip.description?.text,
      ),
    [protocolTips?.tips],
  );

  const handleViewAll = useCallback(() => {
    Dialog.show({
      title: protocolTipsHeader,
      showFooter: false,
      // The tips scroll internally, and on phones the sheet's own drag-to-close
      // competes with that scroll for the same vertical gesture. Overlay press
      // and the system back button still close it.
      disableDrag: true,
      renderContent: <ProtocolTipsDialogContent tips={tips} />,
    });
  }, [protocolTipsHeader, tips]);

  if (tips.length === 0) {
    return null;
  }

  const inlineTip = pickInlineTip(tips);
  const hasMore = tips.length > 1;

  // Card under the chart (per design): rounded outlined card on the page
  // background, with only the heading strip on the subdued fill and the body
  // on the plain one — the inline tip plus a centered blue "View all".
  // Spacing: the parent container has no gap, so $4 is added above; below, the
  // outer section's $8 gap is pulled back to 24px with -$2 to match the
  // design's card spacing.
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
          {protocolTipsHeader}
        </SizableText>
      </YStack>
      <YStack px="$4" py="$3" gap="$2">
        {/* Same EarnText the "View all" dialog uses. Passing `.text` straight
            to SizableText printed the dashboard's <bold>/<url>/<red> markup
            verbatim and left links dead, and dropped the IEarnText color and
            size, so the card and the dialog disagreed on the same data. */}
        <YStack gap="$0.5">
          <EarnText
            text={inlineTip.title}
            size="$bodyMdMedium"
            numberOfLines={1}
          />
          <EarnText
            text={inlineTip.description}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={2}
          />
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
