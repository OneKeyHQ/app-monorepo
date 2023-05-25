import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDropzone } from 'react-dropzone';
import { useIntl } from 'react-intl';
import { read, utils } from 'xlsx';

import type { Token } from '@onekeyhq/engine/src/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { BulkSenderTypeEnum } from './types';

import type { ReceiverError, TokenReceiver } from './types';
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

export function useValidteReceiver({
  networkId,
  receiver,
  type,
  token,
}: {
  networkId: string;
  receiver: TokenReceiver[];
  type: BulkSenderTypeEnum;
  token: Token | null | undefined;
}) {
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [errors, setErrors] = useState<ReceiverError[]>([]);
  const intl = useIntl();

  useEffect(() => {
    (async () => {
      const validateErrors: ReceiverError[] = [];
      setIsValidating(true);
      if (
        type === BulkSenderTypeEnum.NativeToken ||
        type === BulkSenderTypeEnum.Token
      ) {
        for (let i = 0; i < receiver.length; i += 1) {
          const { Address, Amount } = receiver[i];
          let hasError = false;

          const amountBN = new BigNumber(Amount);
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
      }
    })();
  }, [intl, networkId, receiver, token?.decimals, type]);

  return {
    isValid,
    isValidating,
    errors,
  };
}
