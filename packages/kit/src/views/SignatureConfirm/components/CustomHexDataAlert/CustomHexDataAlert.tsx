import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IAlertType } from '@onekeyhq/components';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { getCustomHexDataAlertTitleIds } from './utils';

function HexDataAlert({
  decodedTx,
  onConfirm,
}: {
  decodedTx: IDecodedTx;
  onConfirm: () => void;
}) {
  const intl = useIntl();

  const [continueOperate, setContinueOperate] = useState(false);

  const dialogInstance = useDialogInstance();

  const alerts = useMemo(() => {
    return getCustomHexDataAlertTitleIds(decodedTx).map((id) => ({
      title: intl.formatMessage({
        id,
      }),
      type: 'caution' as IAlertType,
    }));
  }, [decodedTx, intl]);

  return (
    <YStack gap="$5">
      <YStack gap="$2">
        {alerts.map((alert, index) => (
          <Alert
            icon="ErrorOutline"
            key={index}
            type={alert.type}
            title={alert.title}
          />
        ))}
        <Checkbox
          testID="signature-confirm-checkbox"
          label={intl.formatMessage({
            id: ETranslations.send_hex_data_user_understand_risk,
          })}
          value={continueOperate}
          onChange={(checked) => {
            setContinueOperate(!!checked);
          }}
        />
      </YStack>
      <XStack>
        <Button
          testID="signature-confirm-btn"
          variant="primary"
          flexGrow={1}
          flexBasis={0}
          disabled={!continueOperate}
          $md={
            {
              size: 'large',
            } as any
          }
          onPress={async () => {
            await dialogInstance.close();
            onConfirm();
          }}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
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
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.send_send_to_this_address,
    }),
    description: toAddress,
    renderContent: <HexDataAlert decodedTx={decodedTx} onConfirm={onConfirm} />,
    showCancelButton: false,
    showConfirmButton: false,
  });
}

export { showCustomHexDataAlert };
