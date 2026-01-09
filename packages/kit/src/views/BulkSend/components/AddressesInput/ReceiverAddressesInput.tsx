import { useCallback, useState } from 'react';

import { useDebouncedCallback } from 'use-debounce';

import { Form } from '@onekeyhq/components';

import LineNumberedTextArea from './LineNumberedTextArea';

import type { ILineError } from './LineNumberedTextArea';

type ISenderAddressesInputProps = {
  name?: string;
  label?: string;
};

function ReceiverAddressesInput({
  name = 'addresses',
  label = 'Sending Address(es)',
}: ISenderAddressesInputProps) {
  const [errors, setErrors] = useState<ILineError[]>([]);

  const handleUpload = useCallback(() => {
    // TODO: Implement file upload
    console.log('Upload clicked');
  }, []);

  const handleScan = useCallback(() => {
    // TODO: Implement QR scan
    console.log('Scan clicked');
  }, []);

  const handleValidateAddresses = useDebouncedCallback(
    async (value: string) => {
      if (!value) {
        setErrors([]);
        return true;
      }

      const lines = value.split('\n');
      const lineErrors: ILineError[] = [];

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (line) {
          // TODO: Add your validation logic here
          // Example:
          // const isValidAddress = await validateAddress(line);
          // if (!isValidAddress) {
          //   lineErrors.push({
          //     lineNumber: i + 1,
          //     message: 'Invalid address',
          //   });
          // }
        }
      }

      setErrors(lineErrors);
      return lineErrors.length === 0;
    },
    500,
  );

  return (
    <Form.Field
      name={name}
      label={label}
      rules={{
        required: true,
        validate: handleValidateAddresses,
      }}
    >
      <LineNumberedTextArea
        showPaste
        showUpload
        showAccountSelector
        placeholder="Enter addresses, one per line"
        height={300}
        errors={errors}
      />
    </Form.Field>
  );
}

export default ReceiverAddressesInput;
