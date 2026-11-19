import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Divider,
  NumberSizeableText,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  formatKytRiskFactorCategory,
  formatKytRiskFactorEntity,
} from '@onekeyhq/kit/src/utils/kytRiskFactorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

import {
  formatRiskPercent,
  getRiskFactorDisplay,
  isLowShareRiskFactor,
} from '../utils/addressRiskCheckResultUtils';

const CATEGORY_GLOSSARY: {
  category: string;
  desc: ETranslations;
}[] = [
  {
    category: 'sanctioned_entity',
    desc: ETranslations.address_risk_check_category_sanctioned_entity__desc,
  },
  {
    category: 'illicit_activity',
    desc: ETranslations.address_risk_check_category_illicit_activity__desc,
  },
  {
    category: 'mixer',
    desc: ETranslations.address_risk_check_category_mixer__desc,
  },
  {
    category: 'risk_exchange',
    desc: ETranslations.address_risk_check_category_risk_exchange__desc,
  },
  {
    category: 'gambling',
    desc: ETranslations.address_risk_check_category_gambling__desc,
  },
  {
    category: 'bridge',
    desc: ETranslations.address_risk_check_category_bridge__desc,
  },
];

function GlossaryRow({ title, desc }: { title: string; desc: string }) {
  return (
    <YStack gap="$0.5">
      <SizableText size="$bodyMdMedium">{title}</SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {desc}
      </SizableText>
    </YStack>
  );
}

function ExposureGlossaryContent({
  categories,
}: {
  categories: typeof CATEGORY_GLOSSARY;
}) {
  const intl = useIntl();
  return (
    <YStack px="$5" pb="$5" pt={platformEnv.isNative ? '$0' : '$5'} gap="$3">
      <GlossaryRow
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_exposure_direct__msg,
        })}
        desc={intl.formatMessage({
          id: ETranslations.address_risk_check_exposure_direct__desc,
        })}
      />
      <GlossaryRow
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_exposure_indirect__msg,
        })}
        desc={intl.formatMessage({
          id: ETranslations.address_risk_check_exposure_indirect__desc,
        })}
      />
      <GlossaryRow
        title={intl.formatMessage({
          id: ETranslations.kyt_risk_factor_share__title,
        })}
        desc={intl.formatMessage({
          id: ETranslations.address_risk_check_exposure_share__desc,
        })}
      />
      {categories.length ? <Divider /> : null}
      {categories.map((item) => (
        <GlossaryRow
          key={item.category}
          title={formatKytRiskFactorCategory({
            category: item.category,
            intl,
          })}
          desc={intl.formatMessage({ id: item.desc })}
        />
      ))}
    </YStack>
  );
}

function ExposureRow({ factor }: { factor: IKytRiskFactor }) {
  const intl = useIntl();
  const meta: string[] = [];
  if (factor.entity) {
    meta.push(formatKytRiskFactorEntity({ entity: factor.entity, intl }));
  }
  if (factor.exposureType === 'direct') {
    meta.push(
      intl.formatMessage({
        id: ETranslations.address_risk_check_exposure_direct__msg,
      }),
    );
  } else if (factor.exposureType === 'indirect') {
    meta.push(
      intl.formatMessage({
        id: ETranslations.address_risk_check_exposure_indirect__msg,
      }),
    );
    if (factor.hops !== undefined) {
      meta.push(
        intl.formatMessage(
          { id: ETranslations.kyt_risk_factor_distance_hops__msg },
          { count: factor.hops },
        ),
      );
    }
  }

  const primaryColor = isLowShareRiskFactor(factor) ? '$textSubdued' : '$text';

  return (
    <YStack px="$4" py="$3" gap="$0.5">
      <XStack ai="center" jc="space-between" gap="$3">
        <SizableText
          size="$bodyMdMedium"
          color={primaryColor}
          flexShrink={1}
          numberOfLines={1}
        >
          {formatKytRiskFactorCategory({ category: factor.category, intl })}
        </SizableText>
        {factor.percent !== undefined ? (
          <SizableText size="$bodyMdMedium" color={primaryColor}>
            {formatRiskPercent(factor.percent)}
          </SizableText>
        ) : null}
      </XStack>
      <XStack ai="center" jc="space-between" gap="$3">
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          flexShrink={1}
          numberOfLines={2}
        >
          {meta.join(' · ')}
        </SizableText>
        {/* Zero volume means the address itself is the entity. */}
        {factor.amountUsd !== undefined && factor.amountUsd > 0 ? (
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{ currency: '$' }}
            flexShrink={0}
          >
            {String(factor.amountUsd)}
          </NumberSizeableText>
        ) : null}
      </XStack>
    </YStack>
  );
}

// Stable reference so the tooltip trigger stays memoized.
const EXPOSURE_INFO_TRIGGER_PROPS = {
  testID: 'address-risk-check-exposure-info',
};

export function RiskExposureList({ factors }: { factors: IKytRiskFactor[] }) {
  const intl = useIntl();
  const [expanded, setExpanded] = useState(false);
  const display = useMemo(() => getRiskFactorDisplay(factors), [factors]);
  // Only explain the categories this result contains, so the popover stays
  // short; memoized to keep a stable popover content reference.
  const glossaryContent = useMemo(() => {
    const present = new Set(factors.map((factor) => factor.category));
    return (
      <ExposureGlossaryContent
        categories={CATEGORY_GLOSSARY.filter((item) =>
          present.has(item.category),
        )}
      />
    );
  }, [factors]);
  const visibleFactors = expanded
    ? display.sorted
    : display.sorted.slice(0, display.visibleCount);
  const title = intl.formatMessage({
    id: ETranslations.address_risk_check_exposure_breakdown__title,
  });

  return (
    <YStack gap="$2.5">
      <XStack ai="center" gap="$1">
        <SizableText size="$headingSm" color="$textSubdued">
          {title}
        </SizableText>
        <Popover.Tooltip
          title={title}
          placement="bottom"
          iconSize="$4"
          renderContent={glossaryContent}
          triggerProps={EXPOSURE_INFO_TRIGGER_PROPS}
        />
      </XStack>
      <YStack
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        overflow="hidden"
      >
        {visibleFactors.map((factor, index) => (
          <YStack key={`${factor.category}-${factor.entity ?? ''}-${index}`}>
            {index > 0 ? <Divider /> : null}
            <ExposureRow factor={factor} />
          </YStack>
        ))}
      </YStack>
      {!expanded && display.hiddenCount > 0 ? (
        <Button
          testID="address-risk-check-show-more-factors"
          size="small"
          variant="tertiary"
          alignSelf="flex-start"
          cursor="default"
          onPress={() => setExpanded(true)}
        >
          {intl.formatMessage(
            {
              id: display.hiddenAllMinor
                ? ETranslations.address_risk_check_show_more_minor_exposures__action
                : ETranslations.address_risk_check_show_more_exposures__action,
            },
            { count: display.hiddenCount },
          )}
        </Button>
      ) : null}
    </YStack>
  );
}
