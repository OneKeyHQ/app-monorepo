import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Divider,
  SizableText,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useDialogInstance } from '@onekeyhq/components/src/composite/Dialog/hooks';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

// Same caps the protocol intro dialog uses, so every Earn dialog scrolls at the
// same height instead of growing until the sheet swallows the screen.
const DIALOG_CONTENT_MAX_HEIGHT = 512;
const COMPACT_DIALOG_CONTENT_HEIGHT = 260;

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

// The dialog has to get out of the way before a link opens: an <urlInApp> link
// pushes the in-app browser onto the navigation modal stack while this dialog
// renders in its own overlay, so it would otherwise still be sitting there when
// the user comes back from the page — and on native it keeps the sheet stacked
// under the browser the whole time.
function ProtocolTipsDialogContent({ tips }: { tips: IProtocolTipItem[] }) {
  const dialogInstance = useDialogInstance();
  const { md } = useMedia();
  // Await the dismissal: the in-app browser is pushed onto the navigation modal
  // stack while this dialog lives in its own overlay, so opening it mid-exit
  // leaves the two animating over each other (and the dialog waiting behind the
  // page when the user comes back).
  const handleBeforeOpenUrl = useCallback(async () => {
    await dialogInstance.close();
  }, [dialogInstance]);

  return (
    <Dialog.ScrollView
      height={md ? COMPACT_DIALOG_CONTENT_HEIGHT : undefined}
      maxHeight={md ? undefined : DIALOG_CONTENT_MAX_HEIGHT}
      nestedScrollEnabled
    >
      <YStack gap="$4" pb="$2">
        {tips.map((tip, index) => (
          <YStack key={index} gap="$4">
            {index > 0 ? <Divider /> : null}
            <ProtocolTipRow tip={tip} onBeforeOpenUrl={handleBeforeOpenUrl} />
          </YStack>
        ))}
      </YStack>
    </Dialog.ScrollView>
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
