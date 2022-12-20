import type { FC } from 'react';

import useSWR from 'swr';

import { Button, Center, Typography } from '@onekeyhq/components';

type RequestPayload<T> = {
  message: string;
  code: number;
  data: T;
};

type GasPriceRequestData = {
  'SafeGasPrice': string;
  'ProposeGasPrice': string;
  'FastGasPrice': string;
};

const Request: FC = () => {
  const { data, error, mutate } = useSWR<RequestPayload<GasPriceRequestData>>(
    'https://defi.onekey.so/onestep/api/v1/gas_price?chain_id=1',
  );

  if (error)
    return (
      <Center flex={1}>
        <Typography.Body1 color="text-default">
          network issue: request failed to load
        </Typography.Body1>
      </Center>
    );

  if (!data)
    return (
      <Center flex={1}>
        <Typography.Body1 color="text-default">loading...</Typography.Body1>
      </Center>
    );

  const { message, code, data: result } = data;

  if (code !== 0)
    return (
      <Center flex={1}>
        <Typography.Body1 color="text-default">{message}</Typography.Body1>
      </Center>
    );

  return (
    <Center flex={1}>
      <Typography.Body1 color="text-default">
        慢：{result.SafeGasPrice}
      </Typography.Body1>
      <Typography.Body1 color="text-default">
        中：{result.ProposeGasPrice}
      </Typography.Body1>
      <Typography.Body1 color="text-default">
        快：{result.FastGasPrice}
      </Typography.Body1>
      <Button onPress={() => mutate()}>REFETCH</Button>
    </Center>
  );
};

export default Request;
