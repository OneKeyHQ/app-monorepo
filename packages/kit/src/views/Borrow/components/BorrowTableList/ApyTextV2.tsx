import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { AprText } from '@onekeyhq/kit/src/views/Earn/components/AprText';
import { EarnIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IBorrowApy,
  IBorrowApyDetailItem,
  IBorrowApyDetailPopupData,
  IBorrowApyDetailSection,
} from '@onekeyhq/shared/types/staking';

type IApyTextV2Props = {
  apyDetail: IBorrowApy;
};

function ApyDetailSection({
  section,
  showDivider,
}: {
  section?: IBorrowApyDetailSection;
  showDivider?: boolean;
}) {
  if (!section || section.items.length === 0) return null;

  return (
    <>
      {/* Section Title */}
      {section.title ? (
        <SizableText
          size="$bodySmMedium"
          color="$textSubdued"
          mt="$4"
          mb="$3.5"
        >
          <EarnText text={section.title} />
        </SizableText>
      ) : null}

      {/* Section Items */}
      <YStack gap="$3.5">
        {section.items.map((item: IBorrowApyDetailItem, index: number) => (
          <XStack key={index} jc="space-between" ai="flex-start">
            <XStack ai="flex-start" gap="$2.5" flex={1}>
              {item.icon ? (
                <Icon name={item.icon.icon} size="$4" color="$iconSubdued" />
              ) : null}
              {!item.icon && item.logoURI ? (
                <Token size="sm" tokenImageUri={item.logoURI} />
              ) : null}
              <YStack flex={1} gap="$0.5">
                <EarnText
                  text={item.title}
                  size="$bodyMdMedium"
                  color="$text"
                />
                {item.description ? (
                  <EarnText
                    text={item.description}
                    size="$bodySm"
                    color="$textSubdued"
                  />
                ) : null}
              </YStack>
            </XStack>
            <XStack ai="center" gap="$1">
              {item.value.icon ? <EarnIcon icon={item.value.icon} /> : null}
              <EarnText text={item.value.text} size="$bodyMd" color="$text" />
            </XStack>
          </XStack>
        ))}
      </YStack>

      {/* Section Descriptions - at the bottom */}
      {section.descriptions?.map((desc, index) => (
        <SizableText
          key={index}
          size="$bodySm"
          color="$textSubdued"
          mt="$3.5"
          mb="$4"
        >
          <EarnText text={desc} />
        </SizableText>
      ))}

      {showDivider ? <Divider my="$3" /> : null}
    </>
  );
}

function ApyDetailTotalItem({
  icon,
  title,
  description,
  value,
}: {
  icon?: IBorrowApyDetailItem['icon'];
  title: IBorrowApyDetailItem['title'];
  description?: IBorrowApyDetailItem['description'];
  value: IBorrowApyDetailItem['value'];
}) {
  return (
    <XStack jc="space-between" ai="center">
      <XStack ai="center" gap="$2" flex={1}>
        {icon ? <Icon name={icon.icon} size="$4" color="$iconSubdued" /> : null}
        <YStack flex={1}>
          <EarnText text={title} size="$bodyMd" color="$text" />
          {description ? (
            <EarnText text={description} size="$bodySm" color="$textSubdued" />
          ) : null}
        </YStack>
      </XStack>
      <EarnText text={value.text} size="$bodyMd" color="$text" />
    </XStack>
  );
}

// Reusable popover detail content component
function ApyDetailPopoverContent({
  popupData,
}: {
  popupData: IBorrowApyDetailPopupData | undefined;
}) {
  return (
    <YStack
      p="$5"
      overflow="hidden"
      onPress={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Native APY (top section) */}
      <ApyDetailSection
        section={popupData?.apyDetail.normal}
        showDivider={
          !!(
            popupData?.apyDetail.platformBonus ||
            popupData?.apyDetail.collateralBonus ||
            popupData?.apyDetail.supplyBonus
          )
        }
      />

      {/* Platform Bonus section */}
      <ApyDetailSection
        section={popupData?.apyDetail.platformBonus}
        showDivider={
          !!(
            popupData?.apyDetail.collateralBonus ||
            popupData?.apyDetail.supplyBonus
          )
        }
      />

      {/* Collateral Bonus section */}
      <ApyDetailSection
        section={popupData?.apyDetail.collateralBonus}
        showDivider={!!popupData?.apyDetail.supplyBonus}
      />

      {/* Supply Bonus section */}
      <ApyDetailSection section={popupData?.apyDetail.supplyBonus} />

      {/* Total APY (bottom section) */}
      {popupData?.apyDetail.totalApy ? (
        <>
          <Divider my="$3" />
          <ApyDetailTotalItem
            icon={
              popupData.apyDetail.totalApy.icon || {
                icon: 'ChartColumnar3Outline',
              }
            }
            title={popupData.apyDetail.totalApy.title}
            description={popupData.apyDetail.totalApy.description}
            value={popupData.apyDetail.totalApy.value}
          />
        </>
      ) : null}
    </YStack>
  );
}

// Reusable highlight content component
function HighlightContent({ text, color }: { text: string; color?: string }) {
  return (
    <YStack ai="flex-end" gap="$0.5">
      <XStack alignItems="center" gap="$1">
        <Icon name="Ai2StarSolid" size="$4" color="$iconSuccess" />
        <SizableText
          size="$bodyLgMedium"
          textAlign="right"
          color={color || '$textSuccess'}
        >
          {text}
        </SizableText>
      </XStack>
      <Stack
        width="100%"
        height={0}
        borderBottomWidth="$0.5"
        borderBottomColor={color || '$textSuccess'}
        borderStyle="dotted"
        borderTopWidth={0}
        borderLeftWidth={0}
        borderRightWidth={0}
      />
    </YStack>
  );
}

export const ApyTextV2 = ({ apyDetail }: IApyTextV2Props) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);

  const hasDetail = !!apyDetail.button;
  const popupData = apyDetail.button?.data;
  const { highlight, deprecated } = apyDetail;

  // Memoize highlight content to avoid recreation
  const highlightElement = useMemo(() => {
    if (!highlight) return null;
    return <HighlightContent text={highlight.text} color={highlight.color} />;
  }, [highlight]);

  // Memoize deprecated content
  const deprecatedElement = useMemo(() => {
    if (!deprecated) return null;
    return (
      <SizableText
        size="$bodyMd"
        textAlign="right"
        color={deprecated.color || '$textSubdued'}
        textDecorationLine="line-through"
      >
        {deprecated.text}
      </SizableText>
    );
  }, [deprecated]);

  // Render highlight with optional popover
  const renderHighlightWithPopover = useCallback(() => {
    if (!highlightElement) return null;

    const content = hasDetail ? (
      <Popover
        open={open}
        onOpenChange={setOpen}
        renderTrigger={<Stack cursor="pointer">{highlightElement}</Stack>}
        title={intl.formatMessage({ id: ETranslations.global_details })}
        renderContent={<ApyDetailPopoverContent popupData={popupData} />}
      />
    ) : (
      highlightElement
    );

    return content;
  }, [hasDetail, highlightElement, intl, open, popupData, setOpen]);

  // Case 1: Both highlight and deprecated exist
  if (highlight && deprecated) {
    return (
      <YStack alignItems="flex-end" gap="$0.5">
        {renderHighlightWithPopover()}
        {deprecatedElement}
      </YStack>
    );
  }

  // Case 2: Highlight only
  if (highlight) {
    return <YStack ai="flex-end">{renderHighlightWithPopover()}</YStack>;
  }

  // Case 3: Fallback to AprText for other cases
  return (
    <YStack ai="flex-end">
      <AprText
        asset={{
          aprWithoutFee: apyDetail.apy,
          aprInfo: apyDetail,
        }}
      />
    </YStack>
  );
};
