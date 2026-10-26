import { useIntl } from 'react-intl';

import {
  Dialog,
  SizableText,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpTestIDs } from '../../../testIDs';
import { PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS } from '../../PerpDialogLayout';

import type { IntlShape } from 'react-intl';

const RISK_LEVELS = [
  {
    label: ETranslations.perp_margin_ratio_low_risk__title,
    range: '≤ 40%',
    color: '$bgAccent',
  },
  {
    label: ETranslations.perp_margin_ratio_medium_risk__title,
    range: ETranslations.perp_margin_ratio_range_inclusive__msg,
    rangeValues: { lower: 40, upper: 70 },
    color: '$textCaution',
  },
  {
    label: ETranslations.perp_portfolio_health_status_high_risk,
    range: ETranslations.perp_margin_ratio_range_exclusive__msg,
    rangeValues: { lower: 70, upper: 100 },
    color: '$bgCriticalStrong',
  },
  {
    label: ETranslations.perp_margin_ratio_liquidation_risk__title,
    range: '≥ 100%',
    color: '$text',
  },
] as const;

function MarginRatioRiskDialogContent() {
  const intl = useIntl();
  const themeName = useThemeName();
  return (
    <Dialog.ScrollView maxHeight={420}>
      <YStack gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage(
            { id: ETranslations.perp_margin_ratio_risk_levels__desc },
            { threshold: 100 },
          )}
        </SizableText>
        <YStack
          py="$2"
          overflow="hidden"
          bg={themeName === 'light' ? '$bgSubdued' : '$bgStrong'}
          borderRadius="$6"
          borderCurve="continuous"
        >
          {RISK_LEVELS.map((level, index) => (
            <XStack
              key={level.label}
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              minHeight="$12"
              px="$4"
              py="$3"
              borderBottomWidth={index < RISK_LEVELS.length - 1 ? '$px' : 0}
              borderBottomColor="$bg"
            >
              <SizableText
                size="$bodyMd"
                color={level.color}
                flex={1}
                minWidth={0}
              >
                {intl.formatMessage({ id: level.label })}
              </SizableText>
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="right"
                fontVariant={['tabular-nums']}
                flexShrink={0}
              >
                {'rangeValues' in level
                  ? intl.formatMessage({ id: level.range }, level.rangeValues)
                  : level.range}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      </YStack>
    </Dialog.ScrollView>
  );
}

let activeRiskDialog: ReturnType<typeof Dialog.show> | undefined;

export function showMarginRatioRiskDialog(intl: IntlShape) {
  if (activeRiskDialog) {
    return activeRiskDialog;
  }

  const dialogInstance = Dialog.show({
    title: intl.formatMessage({
      id: ETranslations.perp_margin_ratio_risk_levels__title,
    }),
    testID: PerpTestIDs.MarginRatioRiskDialog,
    showFooter: false,
    showExitButton: true,
    contentContainerProps: PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
    renderContent: <MarginRatioRiskDialogContent />,
    onClose: () => {
      if (activeRiskDialog === dialogInstance) {
        activeRiskDialog = undefined;
      }
    },
  });
  activeRiskDialog = dialogInstance;
  return dialogInstance;
}
