import { useIntl } from 'react-intl';

import {
  Divider,
  EStepItemStatus,
  SizableText,
  Stack,
  Stepper,
  YStack,
} from '@onekeyhq/components';
import type { IStepItemProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import { useEarnEventActive } from '../../hooks/useEarnEventActive';

function CustomStepperItem({ title, description, ...props }: IStepItemProps) {
  return (
    <Stepper.Item
      {...props}
      containerStyle={{
        pb: '$3',
      }}
      textContainerStyle={{
        gap: '$1',
        $gtMd: {
          flexDirection: 'row',
        },
      }}
      renderTitle={({ status }) => {
        return (
          <SizableText size="$bodyMd" color="$textSubdued">
            {title}
          </SizableText>
        );
      }}
      renderDescription={({ status }) => {
        return (
          <SizableText
            size="$bodyMdMedium"
            color={status === EStepItemStatus.Done ? '$textSubdued' : undefined}
          >
            {description}
          </SizableText>
        );
      }}
      renderProgressBar={
        <Stack
          flex={1}
          position="absolute"
          left={9}
          bg="$iconDisabled"
          top={26}
          bottom={0}
          w="$0.5"
          h="$6"
          borderTopLeftRadius="$2"
          borderTopRightRadius="$2"
          borderBottomLeftRadius="$2"
          borderBottomRightRadius="$2"
          borderCurve="continuous"
          $gtMd={{
            h: '$3',
            top: 20,
          }}
        />
      }
      renderStatusIndicator={() => {
        return (
          <Stack
            w="$2"
            h="$2"
            m="$1.5"
            borderRadius="$full"
            bg="$iconDisabled"
          />
        );
      }}
    />
  );
}

export function PeriodSection({
  details,
}: {
  details?: IStakeProtocolDetails;
}) {
  const intl = useIntl();

  const { provider } = details ?? {};
  const { isEventActive, effectiveTime } = useEarnEventActive(
    provider?.eventEndTime,
  );
  const isPreStakedUser = details?.preStaked;

  if (!earnUtils.isFalconProvider({ providerName: provider?.name ?? '' })) {
    return null;
  }

  if (!isEventActive && !isPreStakedUser) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.earn_period })}
        </SizableText>
        <YStack>
          <Stepper stepIndex={isEventActive ? 0 : 1}>
            <CustomStepperItem
              title={intl.formatMessage({
                id: ETranslations.earn_period_label_1,
              })}
              description={intl.formatMessage(
                {
                  id: ETranslations.earn_period_ends_on_date,
                },
                {
                  date: formatDate(new Date(effectiveTime)),
                },
              )}
            />
            <CustomStepperItem
              title={intl.formatMessage({
                id: ETranslations.earn_period_label_2,
              })}
              description={intl.formatMessage({
                id: ETranslations.earn_period_real_time_update,
              })}
            />
            <CustomStepperItem
              title={intl.formatMessage({
                id: ETranslations.earn_period_label_3,
              })}
              description={intl.formatMessage({
                id: ETranslations.earn_period_tge_time,
              })}
            />
            <CustomStepperItem
              title={intl.formatMessage({
                id: ETranslations.earn_period_label_4,
              })}
              description={intl.formatMessage({
                id: ETranslations.earn_period_tge_time,
              })}
            />
          </Stepper>
        </YStack>
      </YStack>
      <Divider />
    </>
  );
}
