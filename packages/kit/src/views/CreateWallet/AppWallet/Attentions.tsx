import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Icon,
  Modal,
  Typography,
} from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';

type AttentionsProps = { onPress: () => void };

export const Attentions: FC<AttentionsProps> = ({ onPress }) => {
  const intl = useIntl();
  const insets = useSafeAreaInsets();
  const List = [
    {
      emoji: '🔐',
      desc: intl.formatMessage({ id: 'modal__attention_unlock' }),
    },
    { emoji: '🤫', desc: intl.formatMessage({ id: 'modal__attention_shh' }) },
    {
      emoji: '🙅‍♂️',
      desc: intl.formatMessage({ id: 'modal__attention_gesturing_no' }),
    },
  ];
  return (
    <Modal footer={null}>
      <Box flex={1} px={{ base: 2, md: 0 }}>
        <Box flex={1}>
          <Center mb={8}>
            <Center p={4} mb={4} bg="surface-warning-default" rounded="full">
              <Icon
                name="ExclamationTriangleOutline"
                width={24}
                height={24}
                color="icon-warning"
              />
            </Center>
            <Typography.DisplayLarge>
              {intl.formatMessage({ id: 'modal__attention' })}
            </Typography.DisplayLarge>
          </Center>
          {List.map((item) => (
            <Box flexDirection="row" mb={4} key={item.desc}>
              <Typography.DisplayLarge mt={-1} mr={4}>
                {item.emoji}
              </Typography.DisplayLarge>
              <Typography.Body1 flex={1}>{item.desc}</Typography.Body1>
            </Box>
          ))}
        </Box>
        <Button
          mt={4}
          mb={`${insets.bottom}px`}
          size="xl"
          type="primary"
          onPress={onPress}
        >
          {intl.formatMessage({ id: 'action__reveal_recovery_phrase' })}
        </Button>
      </Box>
    </Modal>
  );
};
