import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { read, utils } from 'xlsx';

import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';
import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useNetworkSimple } from '../../hooks';

import { AmountTypeEnum, TraderTypeEnum } from './types';

import type { TokenTrader, TraderError } from './types';
import type { DropzoneOptions } from 'react-dropzone';

export function useDropUpload<T>(
  props: DropzoneOptions & {
    header?: string[] | number;
  },
) {
  const { header } = props;
  const [data, setData] = useState<T[]>([]);

  const dropZoneState = useDropzone({
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
    onDropAccepted: async (files) => {
      try {
        const file = await files[0].arrayBuffer();
        const wb = read(file, { raw: true });
        const json = utils.sheet_to_json<T>(wb.Sheets[wb.SheetNames[0]], {
          header,
        });
        setData(json);
      } catch {
        // pass
      }
    },
    ...props,
  });

  return {
    ...dropZoneState,
    data,
  };
}

export function useValidteTrader({
  networkId,
  trader,
  token,
  bulkType,
  traderType,
  amountType,
}: {
  networkId: string;
  trader: TokenTrader[];
  token: Token | null | undefined;
  bulkType: BulkTypeEnum;
  traderType: TraderTypeEnum;
  amountType: AmountTypeEnum;
}) {
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [errors, setErrors] = useState<TraderError[]>([]);
  const intl = useIntl();
  const network = useNetworkSimple(networkId);

  useEffect(() => {
    (async () => {
      const validateErrors: TraderError[] = [];
      setIsValidating(true);
      for (let i = 0; i < trader.length; i += 1) {
        const { Address, Amount } = trader[i];
        let hasError = false;
        if (
          amountType === AmountTypeEnum.Custom &&
          ((bulkType === BulkTypeEnum.OneToMany &&
            traderType === TraderTypeEnum.Receiver) ||
            (bulkType === BulkTypeEnum.ManyToOne &&
              traderType === TraderTypeEnum.Sender) ||
            (bulkType === BulkTypeEnum.ManyToMany &&
              traderType === TraderTypeEnum.Sender))
        ) {
          const amountBN = new BigNumber(Amount ?? 0);
          if (!hasError) {
            if (amountBN.isNaN() || amountBN.isNegative()) {
              validateErrors.push({
                lineNumber: i + 1,
                message: intl.formatMessage({
                  id: 'form__modify_the_line_with_the_correct_format',
                }),
              });
              hasError = true;
            }
          }

          if (!hasError && token?.decimals) {
            if (!amountBN.shiftedBy(token.decimals).isInteger()) {
              validateErrors.push({
                lineNumber: i + 1,
                message: intl.formatMessage(
                  {
                    id: 'msg__please_limit_the_amount_of_tokens_to_str_decimal_places_or_less',
                  },
                  {
                    '0': token.decimals,
                  },
                ),
              });
              hasError = true;
            }
          }

          if (!hasError) {
            if (network?.settings.minTransferAmount) {
              const minTransferAmountBN = new BigNumber(
                network.settings.minTransferAmount,
              );
              if (amountBN.lt(minTransferAmountBN)) {
                validateErrors.push({
                  lineNumber: i + 1,
                  message: intl.formatMessage(
                    { id: 'form__str_minimum_transfer' },
                    { 0: minTransferAmountBN.toFixed(), 1: token?.symbol },
                  ),
                });
                hasError = true;
              }
            }
          }
        }

        if (!hasError) {
          try {
            await backgroundApiProxy.validator.validateAddress(
              networkId,
              Address.trim(),
            );
          } catch {
            validateErrors.push({
              lineNumber: i + 1,
              message: intl.formatMessage({
                id: 'form__incorrect_address_format',
              }),
            });
            hasError = true;
          }
        }
      }

      setIsValidating(false);
      setIsValid(validateErrors.length === 0);
      setErrors(validateErrors);
    })();
  }, [
    amountType,
    bulkType,
    intl,
    network?.settings.minTransferAmount,
    networkId,
    token?.decimals,
    token?.symbol,
    trader,
    traderType,
  ]);

  return {
    isValid,
    isValidating,
    errors,
  };
}
