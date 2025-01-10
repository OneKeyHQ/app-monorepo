import { useCallback } from 'react';

import type { IErrorMessageComponentType } from '@onekeyhq/components';
import { useFormContext } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';

export function SendDataInputErrorHyperlinkText(
  props: IErrorMessageComponentType,
) {
  const form = useFormContext();

  const onLinkPress = useCallback(async () => {
    const values = form.getValues();
    const { to, accountId, networkId } = values;
    const address =
      typeof to === 'string' ? to : (to as { address: string }).raw;
    if (!address) {
      return;
    }
    const result = await backgroundApiProxy.serviceAccountProfile.queryAddress({
      accountId,
      networkId,
      address,
      enableAddressBook: true,
      enableWalletName: true,
      skipValidateAddress: true,
    });
    console.log('result', result);
  }, [form]);
  return (
    <HyperlinkText
      {...props}
      autoHandleResult={false}
      values={{
        contactId: '#',
        contactAddress: '#',
      }}
      onLinkPress={onLinkPress}
    />
  );
}
