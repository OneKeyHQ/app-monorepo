import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IBadgeType } from '@onekeyhq/components';
import { Badge, ListItem, Text, YStack } from '@onekeyhq/components';
import type { IGasEIP1559Prediction } from '@onekeyhq/shared/types/gas';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { getFeeConfidenceLevelStyle } from '../../../../utils/gasFee';

type IProps = {
  networkId: string;
  onSelected: (feePrediction: IGasEIP1559Prediction) => void;
};

function FeePredictionContainer(props: IProps) {
  const { networkId, onSelected } = props;
  const intl = useIntl();

  const { prediction } =
    usePromiseResult(async () => {
      const r = await backgroundApiProxy.serviceGas.estimateGasFee({
        networkId,
      });
      return r;
    }, [networkId]).result ?? {};

  const renderPrediction = useCallback(
    (item: IGasEIP1559Prediction, index: number) => {
      const title = `${intl.formatMessage({ id: 'form__priority_fee' })}: ${
        item.maxPriorityFeePerGas
      }`;

      const subtitle = `${intl.formatMessage({ id: 'form__max_fee' })}: ${
        item.maxFeePerGas
      }`;

      const { badgeType } = getFeeConfidenceLevelStyle(item.confidence);
      return (
        <ListItem
          key={index}
          title={title}
          subtitle={subtitle}
          onPress={() => onSelected(item)}
        >
          <Badge type={badgeType as IBadgeType} size="lg">
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

  if (!prediction || prediction.length === 0) return null;

  return (
    <YStack space="$4" px="$5" py="$2">
      <Text variant="$bodyMd" color="$textSubdued">
        Gas Fee Prediction
      </Text>
      <YStack>{prediction.map(renderPrediction)}</YStack>
    </YStack>
  );
}

export { FeePredictionContainer };
