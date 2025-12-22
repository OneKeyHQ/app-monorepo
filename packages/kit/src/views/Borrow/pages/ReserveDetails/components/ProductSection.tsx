import { Fragment } from 'react';

import { Image, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type {
  IBorrowReserveDetail,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { DetailsSectionContainer } from './DetailsSectionContainer';

const fallbackText: IEarnText = { text: '-' };

function ManagersSection({
  managers,
}: {
  managers: IBorrowReserveDetail['managers'] | undefined;
}) {
  return managers?.items?.length ? (
    <XStack gap="$1" alignItems="center">
      {managers.items.map((item, index) => (
        <Fragment key={index}>
          <XStack gap="$1" alignItems="center">
            <Image size="$4" borderRadius="$1" src={item.logoURI} />
            <EarnText text={item.title} size="$bodySm" />
            <EarnText text={item.description} size="$bodySm" />
          </XStack>
          {index !== managers.items.length - 1 ? (
            <XStack w="$4" h="$4" ai="center" jc="center">
              <XStack w="$1" h="$1" borderRadius="$full" bg="$iconSubdued" />
            </XStack>
          ) : null}
        </Fragment>
      ))}
    </XStack>
  ) : null;
}

export function ProductSection({
  details,
}: {
  details?: IBorrowReserveDetail;
}) {
  if (!details) {
    return null;
  }

  const interestRateModelText = details.interestRateModel
    ? { text: details.interestRateModel }
    : fallbackText;

  return (
    <DetailsSectionContainer title="Product">
      <YStack gap="$4">
        <ManagersSection managers={details.managers} />
        <XStack flexWrap="wrap" m="$-5" p="$2">
          <GridItem
            title={{ text: 'Interest rate model' }}
            description={interestRateModelText}
          />
        </XStack>
      </YStack>
    </DetailsSectionContainer>
  );
}
