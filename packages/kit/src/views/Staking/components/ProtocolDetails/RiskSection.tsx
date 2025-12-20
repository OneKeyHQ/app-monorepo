import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { FALCON_DOCS_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

export function RiskSection({ details }: { details?: IStakeProtocolDetails }) {
  const intl = useIntl();

  const { provider } = details ?? {};

  if (!earnUtils.isFalconProvider({ providerName: provider?.name ?? '' })) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_risk })}
        </SizableText>
        <XStack ai="center" gap="$3">
          <YStack flex={1} gap="$2">
            <XStack ai="center" gap="$2">
              <XStack
                ai="center"
                jc="center"
                w="$6"
                h="$6"
                bg="$bgCaution"
                borderRadius="$1"
              >
                <Icon name="PeopleShadowSolid" size="$4" color="$iconCaution" />
              </XStack>
              <SizableText size="$bodyMdMedium">
                {intl.formatMessage({ id: ETranslations.earn_usdf_risk_title })}
              </SizableText>
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.earn_usdf_risk_desc })}
            </SizableText>
          </YStack>
          <IconButton
            icon="OpenOutline"
            color="$iconSubdued"
            size="small"
            bg="transparent"
            onPress={() => {
              openUrlExternal(FALCON_DOCS_URL);
            }}
          />
        </XStack>
      </YStack>
      <Divider />
    </>
  );
}
