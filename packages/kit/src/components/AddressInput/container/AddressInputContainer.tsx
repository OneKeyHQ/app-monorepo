import type { ComponentProps } from 'react';

import { Stack, TextArea } from '@onekeyhq/components';

type IProps = ComponentProps<typeof TextArea> & {
  placeholder?: string;
  onChange?: (value: string) => void;
};

function AddressInputContainer(props: IProps) {
  const { placeholder } = props;
  return (
    <Stack width="100%" borderRadius={12}>
      <TextArea placeholder={placeholder} />
    </Stack>
  );
}

export { AddressInputContainer };
