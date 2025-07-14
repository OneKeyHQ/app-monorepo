import { useIntl } from 'react-intl';

import {
  Icon,
  LinearGradient,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

function ClaimResourceEntry() {
  const intl = useIntl();
  return (
    <LinearGradient
      colors={['#63c811', '#00a3ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: 32, padding: 2 }}
    >
      <XStack
        {...listItemPressStyle}
        alignItems="center"
        gap={2}
        borderRadius="$8"
        px={8}
        py={2}
        backgroundColor="$bgApp"
        onPress={() => {
          console.log('ClaimResourceEntry');
        }}
        cursor="pointer"
      >
        <Icon name="GiftSolid" size="$3" color="$iconSubdued" />
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.earn_claim_rewards,
          })}
        </SizableText>
      </XStack>
    </LinearGradient>
  );
}

export default ClaimResourceEntry;
