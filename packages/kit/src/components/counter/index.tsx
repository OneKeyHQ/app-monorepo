import React, { useState } from 'react';
import { Button, Box, Input, Center, Stack } from '@onekeyhq/components';

import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import {
  decrement,
  increment,
  incrementByAmount,
  incrementAsync,
  incrementIfOdd,
  selectCount,
} from '../../store/reducers/counter';

function Counter() {
  const dispatch = useAppDispatch();
  const count = useAppSelector(selectCount);
  const [incrementAmount, setIncrementAmount] = useState('2');

  const incrementValue = Number(incrementAmount) || 0;

  return (
    <Center flex={1} px="3" mt="3">
      <Stack
        direction={{
          base: 'column',
          md: 'row',
        }}
        space={4}
      >
        <Button size="lg" onPress={() => dispatch(decrement())}>
          -
        </Button>
        <Center>{count}</Center>
        <Button size="lg" onPress={() => dispatch(increment())}>
          +
        </Button>
      </Stack>
      <Box mt="3">
        <Input
          placeholder="Set increment amount"
          value={incrementAmount}
          onChange={(e) => setIncrementAmount(e.target.toString())}
        />
        <Stack
          direction={{
            base: 'column',
            md: 'row',
          }}
          space={4}
          mt="3"
        >
          <Button
            size="md"
            onPress={() => dispatch(incrementByAmount(incrementValue))}
          >
            Add Amount
          </Button>
          <Button
            size="md"
            onPress={() => dispatch(incrementAsync(incrementValue))}
          >
            Add Async
          </Button>
          <Button
            size="md"
            onPress={() => dispatch(incrementIfOdd(incrementValue))}
          >
            Add If Odd
          </Button>
        </Stack>
      </Box>
    </Center>
  );
}

export default Counter;
