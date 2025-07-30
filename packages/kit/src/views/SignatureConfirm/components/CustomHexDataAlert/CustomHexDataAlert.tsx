import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IAlertType } from '@onekeyhq/components';
import { Alert, Dialog, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { EParseTxType } from '@onekeyhq/shared/types/signatureConfirm';
import {
  EDecodedTxActionType,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';

function HexDataAlert({ decodedTx }: { decodedTx: IDecodedTx }) {
  const intl = useIntl();

  const alerts = useMemo(() => {
    const data: {
      title: string;
      type: IAlertType;
    }[] = [];
    if (decodedTx.isCustomHexData) {
      data.push({
        title: intl.formatMessage({
          id: ETranslations.send_hex_data_contract_interaction_warning,
        }),
        type: 'caution',
      });
    }

    if (decodedTx.isToContract) {
      data.push({
        title: intl.formatMessage({
          id: ETranslations.send_contract_address_detected_warning,
        }),
        type: 'caution',
      });
    }

    if (
      decodedTx.txParseType === EParseTxType.Approve ||
      decodedTx.actions?.find(
        (c) => c.type === EDecodedTxActionType.TOKEN_APPROVE,
      )
    ) {
      data.push({
        title: intl.formatMessage({
          id: ETranslations.send_hex_data_operations_warning,
        }),
        type: 'caution',
      });
    }

    if (
      decodedTx.txParseType === EParseTxType.Unknown &&
      decodedTx.actions?.every(
        (c) =>
          c.type === EDecodedTxActionType.UNKNOWN ||
          c.type === EDecodedTxActionType.FUNCTION_CALL,
      )
    ) {
      data.push({
        title: intl.formatMessage({
          id: ETranslations.send_unrecognized_hex_data_risky_warning,
        }),
        type: 'caution',
      });
    }

    return data;
  }, [decodedTx, intl]);

  return (
    <YStack gap="$2">
      {alerts.map((alert, index) => (
        <Alert
          icon="ErrorOutline"
          key={index}
          type={alert.type}
          title={alert.title}
        />
      ))}
    </YStack>
  );
}

function showCustomHexDataAlert({
  decodedTx,
  toAddress,
  onConfirm,
}: {
  decodedTx: IDecodedTx;
  toAddress: string;
  onConfirm: () => void;
}) {
  return Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.send_send_to_this_address,
    }),
    description: toAddress,
    renderContent: <HexDataAlert decodedTx={decodedTx} />,
    onConfirm: () => {
      onConfirm();
    },
  });
}

export { showCustomHexDataAlert };
