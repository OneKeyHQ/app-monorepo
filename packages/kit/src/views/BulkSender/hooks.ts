import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useDropzone } from 'react-dropzone';
import { read, utils } from 'xlsx';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { BulkSenderTypeEnum, ReceiverErrorEnum } from './types';

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
}: {
  networkId: string;
  receiver: TokenReceiver[];
  type: BulkSenderTypeEnum;
}) {
  const [isValid, setIsValid] = useState(true);
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<ReceiverError[]>([]);

  useEffect(() => {
    (async () => {
      const validateErrors: ReceiverError[] = [];
      setValidating(true);
      if (
        type === BulkSenderTypeEnum.NativeToken ||
        type === BulkSenderTypeEnum.Token
      ) {
        for (let i = 0; i < receiver.length; i += 1) {
          const { Address, Amount } = receiver[i];

          const amountBN = new BigNumber(Amount);
          if (amountBN.isNaN() || amountBN.isNegative()) {
            validateErrors.push({
              lineNumber: i + 1,
              type: ReceiverErrorEnum.IcorrectFormat,
            });
          } else {
            try {
              await backgroundApiProxy.validator.validateAddress(
                networkId,
                Address.trim(),
              );
            } catch {
              validateErrors.push({
                lineNumber: i + 1,
                type: ReceiverErrorEnum.IcorrectAddress,
              });
            }
          }
        }
        setValidating(false);
        setIsValid(validateErrors.length === 0);
        setErrors(validateErrors);
      }
    })();
  }, [networkId, receiver, type]);

  return {
    isValid,
    validating,
    errors,
  };
}
