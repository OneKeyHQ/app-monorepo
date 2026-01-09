import { useDebouncedCallback } from 'use-debounce';

import { Form } from '@onekeyhq/components';

import LineNumberedTextArea from './LineNumberedTextArea';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useBulkSendContext } from '../BulkSendContext';
import { useAccountData } from '../../../../hooks/useAccountData';

type ISenderAddressesInputProps = {};

function SenderAddressesInput({}: ISenderAddressesInputProps) {
  const { selectedNetworkId } = useBulkSendContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });

  const handleValidateAddresses = useDebouncedCallback(
    async (_value: string) => {
      if (!_value) {
        return true;
      }

      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId: selectedNetworkId ?? '',
          address: _value.trim(),
        });

      if (result.isValid) {
        try {
          const walletAccountItems =
            await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
              networkId: selectedNetworkId ?? '',
              address: _value.trim(),
            });
        } catch (e) {
          return 'Address not found in your wallet';
        }

        return `Not a valid ${network?.name ?? ''} address`;
      }
    },
    500,
  );

  return (
    <Form.Field
      name="senderAddresses"
      label="Sending Address(es)"
      rules={{
        required: true,
        validate: handleValidateAddresses,
      }}
    >
      <LineNumberedTextArea
        singleLine
        showPaste
        showAccountSelector
        placeholder="Enter address"
        showLineNumbers={false}
      />
    </Form.Field>
  );
}

export default SenderAddressesInput;
