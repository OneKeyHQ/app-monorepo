import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  DashText,
  Divider,
  Icon,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnActionIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnIcon } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBorrowApy,
  IBorrowApyComponent,
  IBorrowApyDetailItem,
  IBorrowApyDetailPopupData,
  IBorrowApyDetailSection,
} from '@onekeyhq/shared/types/staking';

type IApyTextV2Props = {
  apyDetail: IBorrowApy;
  triggerMode?: 'underline' | 'icon';
};

function hasSectionContent(section?: IBorrowApyDetailSection) {
  if (!section) return false;
  return Boolean(
    section.items.length ||
    section.apyComponents?.length ||
    section.descriptions?.length,
  );
}

function ApyComponentBar({
  components,
}: {
  components?: IBorrowApyComponent[];
}) {
  const { segments, totalWeight } = useMemo(() => {
    if (!components?.length) return { segments: [], totalWeight: 0 };
    let currentTotal = 0;
    const normalized = components.map((component) => {
      const numericValue = Number.parseFloat(component.value);
      const safeValue = Number.isFinite(numericValue)
        ? Math.max(numericValue, 0)
        : 0;
      currentTotal += safeValue;
      return {
        color: component.color || '$bgSubdued',
        weight: safeValue,
      };
    });
    return {
      segments: normalized,
      totalWeight: currentTotal,
    };
  }, [components]);

  if (!segments.length) return null;

  return (
    <XStack
      h="$1.5"
      bg="$bgStrongActive"
      borderRadius="$full"
      overflow="hidden"
    >
      {segments.map((segment, index) => (
        <Stack
          key={index}
          flex={segment.weight}
          bg={segment.color as ColorTokens}
        />
      ))}
      {totalWeight < 100 ? <Stack flex={100 - totalWeight} /> : null}
    </XStack>
  );
}

function ApyDetailSection({
  section,
  showDivider,
}: {
  section?: IBorrowApyDetailSection;
  showDivider?: boolean;
}) {
  if (!section) return null;
  if (!hasSectionContent(section)) return null;

  const hasItems = section.items.length > 0;
  const hasComponents = Boolean(section.apyComponents?.length);
  const hasDescriptions = Boolean(section.descriptions?.length);

  return (
    <>
      {/* Section Title */}
      {section.title ? (
        <EarnText
          text={section.title}
          size="$bodySmMedium"
          color="$textSubdued"
          mb={hasComponents ? '$0' : '$3.5'}
        />
      ) : null}

      {hasComponents ? (
        <Stack mt="$3.5" mb="$3.5">
          <ApyComponentBar components={section.apyComponents} />
        </Stack>
      ) : null}

      {/* Section Items */}
      {hasItems ? (
        <YStack gap="$3.5">
          {section.items.map((item: IBorrowApyDetailItem, index: number) => (
            <XStack key={index} jc="space-between" ai="flex-start">
              <XStack ai="center" gap="$2.5" flex={1}>
                {item.icon ? (
                  <EarnIcon icon={item.icon} size="$4" color="$iconSubdued" />
                ) : null}
                {!item.icon && item.logoURI ? (
                  <Token size="xxs" tokenImageUri={item.logoURI} />
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
                {/* eslint-disable-next-line @typescript-eslint/no-use-before-define */}
                <ApyTextV2 apyDetail={item.value} triggerMode="icon" />
              </XStack>
            </XStack>
          ))}
        </YStack>
      ) : null}

      {/* Section Components Legends */}
      {hasComponents ? (
        <YStack gap="$2.5" mt="$3.5">
          {section.apyComponents?.map((component, index) => {
            if (!component.title) return null;
            return (
              <XStack key={index} ai="center" gap="$2">
                <Stack p="$1" ai="center" jc="center">
                  <Icon
                    name="CirclePlaceholderOnSolid"
                    size="$1.5"
                    color={component.color as ColorTokens}
                  />
                </Stack>
                <EarnText
                  text={component.title}
                  size="$bodySm"
                  color="$textSubdued"
                />
              </XStack>
            );
          })}
        </YStack>
      ) : null}

      {/* Section Descriptions - at the bottom */}
      {hasDescriptions ? (
        <YStack gap="$2.5" mt="$3.5">
          {section.descriptions?.map((desc, index) => (
            <EarnText
              key={index}
              text={desc}
              size="$bodySm"
              color="$textSubdued"
            />
          ))}
        </YStack>
      ) : null}

      {showDivider ? <Divider my="$4" /> : null}
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
      {/* eslint-disable-next-line @typescript-eslint/no-use-before-define */}
      <ApyTextV2 apyDetail={value} triggerMode="icon" />
    </XStack>
  );
}

// Reusable popover detail content component
function ApyDetailPopoverContent({
  popupData,
}: {
  popupData: IBorrowApyDetailPopupData | undefined;
}) {
  const platformSection =
    popupData?.apyDetail.myPlatformBonusShare ||
    popupData?.apyDetail.platformBonus;
  const collateralSection =
    popupData?.apyDetail.myCollateralShare ||
    popupData?.apyDetail.collateralBonus;
  const supplySection = popupData?.apyDetail.supplyBonus;
  const linkDescriptions = popupData?.apyDetail.descriptions;
  const hasPlatformSection = hasSectionContent(platformSection);
  const hasCollateralSection = hasSectionContent(collateralSection);
  const hasSupplySection = hasSectionContent(supplySection);
  const hasLinkDescriptions = Boolean(linkDescriptions?.length);

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
          !!(hasPlatformSection || hasCollateralSection || hasSupplySection)
        }
      />

      {/* Platform Bonus section */}
      <ApyDetailSection
        section={platformSection}
        showDivider={!!(hasCollateralSection || hasSupplySection)}
      />

      {/* Collateral Bonus section */}
      <ApyDetailSection
        section={collateralSection}
        showDivider={!!hasSupplySection}
      />

      {/* Supply Bonus section */}
      <ApyDetailSection section={supplySection} />

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

      {hasLinkDescriptions ? (
        <YStack mt="$3.5" gap="$3">
          {linkDescriptions?.map((desc, index) => (
            <XStack key={index} ai="center" gap="$2">
              <EarnText
                text={desc.text}
                size="$bodySm"
                color="$textSubdued"
                flex={1}
                flexShrink={1}
              />
              <EarnActionIcon title={desc.text.text} actionIcon={desc.button} />
            </XStack>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

// Text with dashed underline component
function TextWithDottedUnderline({
  text,
  color,
  size = '$bodyMdMedium',
}: {
  text: string;
  color?: string;
  size?: '$bodyMdMedium' | '$bodyMd';
}) {
  const textColor = color || '$text';

  return (
    <YStack alignItems="flex-end">
      <DashText
        size={size}
        color={textColor}
        textAlign="right"
        dashColor={textColor}
        dashThickness={1}
      >
        {text}
      </DashText>
    </YStack>
  );
}

function TextWithTrigger({
  text,
  color,
  size = '$bodyMdMedium',
  triggerMode,
  showChevron,
}: {
  text: string;
  color?: string;
  size?: '$bodyMdMedium' | '$bodyMd';
  triggerMode: 'underline' | 'icon';
  showChevron: boolean;
}) {
  if (triggerMode === 'icon') {
    return (
      <XStack alignItems="center" gap="$1">
        <SizableText size={size} textAlign="right" color={color || '$text'}>
          {text}
        </SizableText>
        {showChevron ? (
          <Icon name="ChevronDownSmallOutline" size="$5" color="$iconSubdued" />
        ) : null}
      </XStack>
    );
  }

  return <TextWithDottedUnderline text={text} color={color} size={size} />;
}

// Reusable highlight content component
function HighlightContent({
  text,
  color,
  triggerMode,
  showChevron,
}: {
  text: string;
  color?: string;
  triggerMode: 'underline' | 'icon';
  showChevron: boolean;
}) {
  return (
    <XStack alignItems="flex-start" gap="$1">
      <Icon name="Ai2StarSolid" size="$4" color="$iconSuccess" mt="$1" />
      <TextWithTrigger
        text={text}
        color={color || '$textSuccess'}
        triggerMode={triggerMode}
        showChevron={showChevron}
      />
    </XStack>
  );
}

export const ApyTextV2 = ({
  apyDetail,
  triggerMode = 'underline',
}: IApyTextV2Props) => {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const { gtMd, hoverNone, pointerCoarse } = useMedia();

  const hasDetail = !!apyDetail.button;
  const popupData = apyDetail.button?.data;
  const { highlight, deprecated } = apyDetail;
  const showChevron = triggerMode === 'icon' && hasDetail;
  const useHoverTooltip =
    triggerMode === 'underline' &&
    hasDetail &&
    platformEnv.isRuntimeBrowser &&
    gtMd &&
    !hoverNone &&
    !pointerCoarse;

  const renderDetailOverlay = useCallback(
    (trigger: ReactNode) => {
      if (!hasDetail) {
        return trigger;
      }

      if (useHoverTooltip) {
        return (
          <Tooltip
            hovering
            placement="left"
            renderTrigger={<Stack cursor="pointer">{trigger}</Stack>}
            renderContent={
              <ScrollView>
                <ApyDetailPopoverContent popupData={popupData} />
              </ScrollView>
            }
            contentProps={{
              w: '$96',
              maxWidth: '$96',
              px: '$0',
              py: '$0',
            }}
          />
        );
      }

      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          renderTrigger={<Stack cursor="pointer">{trigger}</Stack>}
          title={intl.formatMessage({ id: ETranslations.global_details })}
          renderContent={<ApyDetailPopoverContent popupData={popupData} />}
        />
      );
    },
    [hasDetail, intl, open, popupData, setOpen, useHoverTooltip],
  );

  // Memoize highlight content to avoid recreation
  const highlightElement = useMemo(() => {
    if (!highlight) return null;
    return (
      <HighlightContent
        text={highlight.text}
        color={highlight.color}
        triggerMode={triggerMode}
        showChevron={showChevron}
      />
    );
  }, [highlight, showChevron, triggerMode]);

  // Memoize deprecated content
  const deprecatedElement = useMemo(() => {
    if (!deprecated) return null;
    return (
      <SizableText
        size="$bodySm"
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
    return renderDetailOverlay(highlightElement);
  }, [highlightElement, renderDetailOverlay]);

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

  // Case 3: Fallback for other cases
  // If hasDetail, render text with dotted underline and popover
  if (hasDetail) {
    // Get the text to display - prefer normal.text, fallback to apy
    const displayText = apyDetail.normal?.text || apyDetail.apy;
    const displayColor = apyDetail.normal?.color || '$text';

    return (
      <YStack ai="flex-end">
        {renderDetailOverlay(
          <TextWithTrigger
            text={displayText}
            color={displayColor}
            triggerMode={triggerMode}
            showChevron={showChevron}
          />,
        )}
      </YStack>
    );
  }

  // No detail, render text directly with consistent font size
  const displayText = apyDetail.normal?.text || apyDetail.apy;
  const displayColor = apyDetail.normal?.color || '$text';

  return (
    <YStack ai="flex-end">
      <SizableText size="$bodyMdMedium" textAlign="right" color={displayColor}>
        {displayText}
      </SizableText>
    </YStack>
  );
};
