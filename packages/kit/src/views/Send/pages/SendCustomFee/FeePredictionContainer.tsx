import { useCallback } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { IBadgeType } from '@onekeyhq/components';
import { Badge, SizableText, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getFeeConfidenceLevelStyle } from '@onekeyhq/kit/src/utils/gasFee';
import type { IGasEIP1559 } from '@onekeyhq/shared/types/fee';

type IProps = {
  networkId: string;
  onSelected: (fee: IGasEIP1559) => void;
};

function FeePredictionContainer(props: IProps) {
  const { networkId, onSelected } = props;
  const intl = useIntl();

  const { gasEIP1559 } =
    usePromiseResult(async () => {
      const r = await backgroundApiProxy.serviceGas.estimateFee({
        networkId,
      });
      return r;
    }, [networkId]).result ?? {};

  const renderPrediction = useCallback(
    (item: IGasEIP1559, index: number) => {
      const title = `${intl.formatMessage({ id: 'form__priority_fee' })}: ${
        item.maxPriorityFeePerGas
      }`;

      const subtitle = `${intl.formatMessage({ id: 'form__max_fee' })}: ${
        item.maxFeePerGas
      }`;

      if (isNil(item.confidence)) return null;

      const { badgeType } = getFeeConfidenceLevelStyle(item.confidence);
      return (
        <ListItem
          key={index}
          title={title}
          subtitle={subtitle}
          onPress={() => onSelected(item)}
        >
          <Badge badgeType={badgeType as IBadgeType} badgeSize="lg">
            {intl.formatMessage(
              { id: 'form__str_probability' },
              { 0: `${item.confidence}%` },
            )}
          </Badge>
        </ListItem>
      );
    },
    [intl, onSelected],
  );

  if (!gasEIP1559 || gasEIP1559.length === 0) return null;

  return (
    <YStack space="$4" px="$5" py="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        Gas Fee Prediction
      </SizableText>
      <YStack>{gasEIP1559.map(renderPrediction)}</YStack>
    </YStack>
  );
}

export { FeePredictionContainer };
