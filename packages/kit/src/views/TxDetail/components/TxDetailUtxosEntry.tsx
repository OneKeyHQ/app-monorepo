import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Icon, Pressable, Text } from '@onekeyhq/components';

type Props = {
  onPress: () => void;
  style?: ComponentProps<typeof Box>;
};

function TxDetailUtxoEntry(props: Props) {
  const { style, onPress } = props;
  const intl = useIntl();
  return (
    <Box {...style}>
      <Pressable.Item
        borderRadius="18px"
        onPress={onPress}
        borderWidth={1}
        borderColor="border-default"
      >
        <HStack space={2} alignItems="center" justifyContent="space-between">
          <Text typography="Body1">
            {intl.formatMessage({ id: 'form__view_inputs_outputs' })}
          </Text>
          <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
        </HStack>
      </Pressable.Item>
    </Box>
  );
}

export { TxDetailUtxoEntry };
