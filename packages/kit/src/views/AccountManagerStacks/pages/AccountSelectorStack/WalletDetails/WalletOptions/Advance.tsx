import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  ESwitchSize,
  SizableText,
  Spinner,
  Stack,
  Switch,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

type IDeviceAdvanceSettingsProps = {
  wallet?: IDBWallet;
  onFail?: (error: Error) => void;
};

function EnterPinOnSoftwareSwitch(
  props: IDeviceAdvanceSettingsProps & {
    defaultValue: boolean;
  },
) {
  const { defaultValue } = props;
  const [enterPinOnSoftware, setEnterPinOnSoftware] = useState(defaultValue);

  return (
    <Switch
      size={ESwitchSize.small}
      value={enterPinOnSoftware}
      onChange={async (v) => {
        try {
          setEnterPinOnSoftware(v);
          await backgroundApiProxy.serviceHardware.setInputPinOnSoftware({
            walletId: props?.wallet?.id || '',
            inputPinOnSoftware: v,
          });
        } catch (error) {
          console.error(error);
          setEnterPinOnSoftware(!v);
        }
      }}
    />
  );
}

function EnablePassphraseSwitch(
  props: IDeviceAdvanceSettingsProps & {
    defaultValue: boolean;
  },
) {
  const { defaultValue } = props;
  const [enablePassphrase, setEnablePassphrase] = useState(defaultValue);

  return (
    <Switch
      size={ESwitchSize.small}
      value={enablePassphrase}
      onChange={async (v) => {
        try {
          setEnablePassphrase(v);
          await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
            walletId: props?.wallet?.id || '',
            passphraseEnabled: v,
          });
        } catch (error) {
          console.error(error);
          setEnablePassphrase(!v);
        }
      }}
    />
  );
}

function AdvanceDialogContent(props: IDeviceAdvanceSettingsProps) {
  const intl = useIntl();
  const { onFail } = props;
  const { result } = usePromiseResult(async () => {
    try {
      return await backgroundApiProxy.serviceHardware.getDeviceAdvanceSettings({
        walletId: props?.wallet?.id || '',
      });
    } catch (error) {
      onFail?.(error as Error);
      throw error;
    }
  }, [onFail, props?.wallet?.id]);

  if (!result) {
    return (
      <Stack borderRadius="$3" p="$5" bg="$bgSubdued" borderCurve="continuous">
        <Spinner size="large" />
      </Stack>
    );
  }

  return (
    <Stack mx="$-5">
      {result.inputPinOnSoftwareSupport ? (
        <ListItem
          title={intl.formatMessage({ id: ETranslations.enter_pin_on_app })}
          pt="$0"
        >
          <EnterPinOnSoftwareSwitch
            {...props}
            defaultValue={result.inputPinOnSoftware}
          />
        </ListItem>
      ) : null}
      <ListItem
        title={intl.formatMessage({ id: ETranslations.global_passphrase })}
      >
        <EnablePassphraseSwitch
          {...props}
          defaultValue={result.passphraseEnabled}
        />
      </ListItem>
      <SizableText px="$5" size="$bodyMd">
        {intl.formatMessage({ id: ETranslations.global_passphrase_desc })}
      </SizableText>
    </Stack>
  );
}

export function Advance(props: IDeviceAdvanceSettingsProps) {
  const intl = useIntl();

  return (
    <WalletOptionItem
      icon="SwitchOutline"
      label={intl.formatMessage({ id: ETranslations.global_advance })}
      onPress={() => {
        const dialog = Dialog.show({
          title: intl.formatMessage({ id: ETranslations.global_advance }),
          renderContent: (
            <AdvanceDialogContent
              {...props}
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
