import React from 'react';

import { Box, Button, Center, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks/redux';
import {
  decrement,
  increment,
  incrementAsync,
  incrementByAmount,
  selectCount,
} from '../../../store/reducers/counter';

const ReduxMessage = () => {
  const { dispatch } = backgroundApiProxy;
  const count = useAppSelector(selectCount);

  return (
    <Box flex="1" bg="background-hovered">
      <Button onPress={() => dispatch(increment())}>+</Button>
      <Button onPress={() => dispatch(decrement())}>-</Button>
      <Button
        onPress={() =>
          dispatch(incrementByAmount(Math.floor(Math.random() * 10)))
        }
      >
        random
      </Button>
      <Button
        onPress={async () => {
          console.log('async action start!');
          // eslint-disable-next-line @typescript-eslint/await-thenable
          await dispatch(incrementAsync(10));
          console.log('async action done!');
        }}
      >
        async action
      </Button>
      <Center>
        <Typography.Body1>{count}</Typography.Body1>
      </Center>
    </Box>
  );
};

export default ReduxMessage;
