import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Text,
  ToastManager,
  Token,
  VStack,
} from '@onekeyhq/components';
import { getUtxoUniqueKey } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token as IToken } from '@onekeyhq/engine/src/types/token';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import { IEncodedTxUpdateType } from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import {
  FormatBalance,
  FormatCurrencyTokenOfAccount,
} from '@onekeyhq/kit/src/components/Format';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNetwork } from '../../../hooks';

export const ModalHeader: FC<{
  networkId: string;
}> = ({ networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        name={network?.name}
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

export const ModalFooter: FC<{
  accountId: string;
  network?: Network | null;
  token?: IToken;
  targetAmount?: string;
  allUtxos: ICoinControlListItem[];
  dustUtxos: ICoinControlListItem[];
  selectedUtxos: string[];
  encodedTx?: IEncodedTxBtc;
  onConfirm?: (selectedUtxos: string[]) => void;
  isLoading: boolean;
}> = ({
  accountId,
  network,
  token,
  targetAmount,
  allUtxos,
  dustUtxos,
  encodedTx,
  selectedUtxos,
  isLoading,
  onConfirm,
}) => {
  const intl = useIntl();

  const sumAmount = useMemo(() => {
    const selectedInputs = allUtxos.filter((utxo) =>
      selectedUtxos.includes(getUtxoUniqueKey(utxo)),
    );
    const sum = selectedInputs.reduce(
      (acc, cur) => acc.plus(cur.value),
      new BigNumber(0),
    );
    return sum;
  }, [allUtxos, selectedUtxos]);

  const missAmount = useMemo(
    () =>
      new BigNumber(targetAmount ?? 0)
        .shiftedBy(network?.decimals ?? 8)
        .minus(sumAmount),
    [targetAmount, sumAmount, network],
  );
  const hasMissAmount = useMemo(() => {
    if (isLoading) return false;
    return missAmount.gt(0);
  }, [missAmount, isLoading]);

  const showDustWarning = useMemo(
    () =>
      selectedUtxos.some((key) =>
        dustUtxos.some((utxo) => getUtxoUniqueKey(utxo) === key),
      ),
    [selectedUtxos, dustUtxos],
  );

  const onPressConfirm = useCallback(
    (utxos: string[]) => {
      if (network && encodedTx) {
        backgroundApiProxy.engine
          .updateEncodedTx({
            networkId: network.id,
            accountId,
            encodedTx,
            payload: {
              selectedUtxos: utxos,
            },
            options: {
              type: IEncodedTxUpdateType.advancedSettings,
            },
          })
          .then(() => {
            onConfirm?.(utxos);
          })
          .catch(() => {
            ToastManager.show(
              {
                title: intl.formatMessage(
                  { id: 'form__amount_invalid' },
                  { 0: network?.symbol },
                ),
              },
              {
                type: 'error',
              },
            );
          });
      }
    },
    [onConfirm, network, encodedTx, accountId, intl],
  );

  return (
    <Box p={4} pt={0}>
      {hasMissAmount && (
        <Text typography="Caption" color="text-critical" mt={2}>
          {intl.formatMessage(
            { id: 'msg__str_btc_missing_from_tx_input' },
            {
              0: `${missAmount
                .shiftedBy(-(network?.decimals ?? 8))
                .toFixed()} ${network?.symbol ?? ''}`,
            },
          )}
        </Text>
      )}
      {showDustWarning && (
        <Text typography="Caption" color="text-warning" mt={2}>
          {intl.formatMessage({
            id: 'msg__using_dust_will_increase_tx_fee_and_reduce_anonymity_and_privacy',
          })}
        </Text>
      )}
      <HStack alignItems="flex-start" justifyContent="space-between" mt={2}>
        <Text typography="Body1Strong">
          {intl.formatMessage(
            { id: 'form__str_selected' },
            { 0: selectedUtxos.length || 0 },
          )}
        </Text>
        <VStack alignItems="flex-end" space={1}>
          <FormatBalance
            balance={sumAmount.shiftedBy(-(network?.decimals ?? 8))}
            formatOptions={{
              fixed: network?.decimals ?? 8,
            }}
            suffix={network?.symbol}
            render={(ele) => <Text typography="Body1Strong">{ele}</Text>}
          />
          <FormatCurrencyTokenOfAccount
            accountId={accountId}
            networkId={network?.id ?? ''}
            token={token}
            value={sumAmount.shiftedBy(-(network?.decimals ?? 8))}
            render={(ele) => (
              <Text typography="Body2" color="text-subdued">
                {ele}
              </Text>
            )}
          />
        </VStack>
      </HStack>
      <Button
        type="primary"
        size="xl"
        mt={4}
        onPress={() => onPressConfirm(selectedUtxos)}
        isDisabled={hasMissAmount}
      >
        {intl.formatMessage({ id: 'action__done' })}
      </Button>
    </Box>
  );
};
