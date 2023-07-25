import { type ComponentProps, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Text } from '@onekeyhq/components';

type Props = {
  leftSeconds: number;
  setLeftSeconds: (leftSeconds: number) => void;
  fetchGasInfo: () => void;
} & ComponentProps<typeof Box>;

let timer: NodeJS.Timeout | null = null;

const TypographySuccess = (text: string) => (
  <Text color="text-success">{text}</Text>
);

function GasRefreshTip(props: Props) {
  const { leftSeconds, setLeftSeconds, fetchGasInfo, ...rest } = props;
  const intl = useIntl();

  useEffect(() => {
    if (leftSeconds === 6) {
      if (timer) {
        clearTimeout(timer);
      }
    }
    timer = setInterval(() => {
      let temp = leftSeconds - 1;
      if (temp < 0) {
        temp = 0;
        fetchGasInfo();
      }
      setLeftSeconds(temp);
    }, 1000);
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [fetchGasInfo, leftSeconds, setLeftSeconds]);

  return (
    <Box {...rest}>
      <Divider />
      <Text color="text-subdued" textAlign="center" mt={4}>
        {intl.formatMessage(
          {
            id: 'content__gas_fee_will_automatically_update_after_str',
          },
          {
            '0': intl.formatMessage(
              { id: 'content__str_seconds_plural' },
              { '0': leftSeconds },
            ),
            'a': TypographySuccess,
          },
        )}
      </Text>
    </Box>
  );
}

export { GasRefreshTip };
