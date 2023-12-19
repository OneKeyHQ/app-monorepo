import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Text, TextArea, YStack } from '@onekeyhq/components';

type IProps = ComponentProps<typeof TextArea> & {
  networkId?: string;
  value?: string;
  onChange?: (address: string) => void;
  placeholder?: string;
  description?: string;
  addressFilter?: (address: string) => Promise<boolean>;
} & React.ComponentProps<typeof TextArea>;

function AddressInput(props: IProps) {
  const {
    value,
    onChange,
    networkId,
    placeholder,
    description,
    addressFilter,
    ...rest
  } = props;
  const intl = useIntl();
  return (
    <YStack space="$2">
      <TextArea
        w="full"
        value={value}
        onChangeText={onChange}
        placeholder={
          placeholder ??
          intl.formatMessage({
            id: 'form__address_and_domain_placeholder',
          })
        }
        {...rest}
      />
      {description && <Text color="$textSubdued">{description}</Text>}
    </YStack>
  );
}

export { AddressInput };
