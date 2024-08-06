import { useIntl } from 'react-intl';

import { Dialog, SizableText, Spinner, Stack } from '@onekeyhq/components';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../../../../hooks/usePromiseResult';

import { WalletOptionItem } from './WalletOptionItem';

function DeviceLabelDialogContent(props: {
  wallet: IDBWallet | undefined;
  onFail: (error: Error) => void;
}) {
  const intl = useIntl();
  const { onFail, wallet } = props;
  const { result } = usePromiseResult(async () => {
    try {
      return await backgroundApiProxy.serviceHardware.getDeviceLabel({
        walletId: wallet?.id || '',
      });
    } catch (error) {
      onFail?.(error as Error);
      throw error;
    }
  }, [onFail, wallet?.id]);

  if (!result) {
    return (
      <Stack borderRadius="$3" p="$5" bg="$bgSubdued" borderCurve="continuous">
        <Spinner size="large" />
      </Stack>
    );
  }

  return (
    <Stack mx="$-5">
      <SizableText px="$5" size="$bodyMd">
        {result}
      </SizableText>
    </Stack>
  );
}

export function HardwareLabelSetButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();

  return (
    <WalletOptionItem
      icon="TagOutline"
      label={intl.formatMessage({
        id: ETranslations.global_hardware_label,
      })}
      onPress={() => {
        const dialog = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.global_hardware_label,
          }),
          renderContent: (
            <DeviceLabelDialogContent
              wallet={wallet}
              onFail={() => {
                void dialog.close();
              }}
            />
          ),
          showFooter: false,
        });
      }}
    />
  );
}
