import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  NumberInput,
  Pressable,
  Select,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  setExpireIn,
  setInstantRate,
} from '../../../../store/reducers/limitOrder';
import { div, formatAmount, lt } from '../../utils';

function formatExpireInString(expireIn: number) {
  const day = 60 * 24;
  const hour = 60;
  const days = Math.floor(expireIn / day);
  if (days > 0) {
    return `${days}D`;
  }
  const hours = Math.floor(expireIn / hour);
  if (hours > 0) {
    return `${hours}H`;
  }
  return `${expireIn}M`;
}

function InstantRateSetting() {
  const intl = useIntl();
  const [reverse, setReverse] = useState(false);

  const tokenIn = useAppSelector((s) => s.limitOrder.tokenIn);
  const tokenOut = useAppSelector((s) => s.limitOrder.tokenOut);
  const instantRate = useAppSelector((s) => s.limitOrder.instantRate);
  const mktRate = useAppSelector((s) => s.limitOrder.mktRate);

  const percent = useMemo(() => {
    if (instantRate && mktRate && instantRate !== mktRate) {
      const bn = new BigNumber(mktRate);
      const percentBN = bn
        .minus(instantRate)
        .absoluteValue()
        .div(mktRate)
        .multipliedBy(100);
      const text = percentBN.decimalPlaces(2).toFixed();
      return lt(instantRate, mktRate) ? `-${text}%` : `+${text}%`;
    }
    return '';
  }, [instantRate, mktRate]);

  const [price, setPrice] = useState(instantRate);

  const onChangeText = useCallback(
    (text: string) => {
      setPrice(text);
      const value = reverse ? formatAmount(div(1, text)) : text;
      backgroundApiProxy.dispatch(setInstantRate(value));
    },
    [reverse],
  );

  const setAsMtkPrice = useCallback(() => {
    const value = reverse ? formatAmount(div(1, mktRate)) : mktRate;
    onChangeText(value);
  }, [mktRate, reverse, onChangeText]);

  const onSwitch = useCallback(() => {
    const newReverse = !reverse;
    const value = newReverse ? formatAmount(div(1, instantRate)) : instantRate;
    setReverse(newReverse);
    setPrice(value);
  }, [reverse, instantRate]);

  const tokenA = !reverse ? tokenIn?.symbol : tokenOut?.symbol;
  const tokenB = !reverse ? tokenOut?.symbol : tokenIn?.symbol;

  return (
    <Box flex="1" backgroundColor="surface-subdued" px="4" pb="4" pt="3">
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flexDirection="row" alignItems="center">
          <Typography.Body1 color="text-subdued" fontSize={12} fontWeight={500}>
            {intl.formatMessage(
              { id: 'form__str_price' },
              { '0': tokenA ?? '' },
            )}
          </Typography.Body1>
          {percent ? (
            <Typography.Caption ml="1" color="text-subdued">
              {percent}
            </Typography.Caption>
          ) : null}
        </Box>

        <Pressable onPress={setAsMtkPrice}>
          <Typography.CaptionUnderline>
            {intl.formatMessage({ id: 'action__set_to_mkt' })}
          </Typography.CaptionUnderline>
        </Pressable>
      </Box>
      <Box flexDirection="row" w="full" alignItems="center">
        <Box flex="1">
          <NumberInput
            borderWidth={0}
            placeholder="0.00"
            fontSize={20}
            fontWeight="600"
            bg="transparent"
            _disabled={{ bg: 'transparent' }}
            _hover={{ bg: 'transparent' }}
            _focus={{ bg: 'transparent' }}
            borderRadius={0}
            pl={0}
            rightCustomElement={null}
            focusOutlineColor="transparent"
            value={price ?? ''}
            onChangeText={onChangeText}
          />
        </Box>
        <Box>
          <Pressable
            flexDirection="row"
            alignItems="center"
            bg="surface-neutral-subdued"
            py="1"
            px="1.5"
            borderRadius={8}
            onPress={onSwitch}
          >
            <Typography.CaptionStrong color="text-subdued" mr="1">
              {tokenB ?? ''}
            </Typography.CaptionStrong>
            <Icon name="ArrowsRightLeftMini" size={10} />
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}

function ExpireSetting() {
  const intl = useIntl();

  const options = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 10 }),
        value: 10,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { '0': 1 }),
        value: 60,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hours' }, { '0': 24 }),
        value: 1440,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 7 }),
        value: 10080,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 30 }),
        value: 43200,
      },
    ];
    if (platformEnv.isDev) {
      data.unshift({
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 1 }),
        value: 1,
      });
    }
    return data;
  }, [intl]);

  const expireIn = useAppSelector((s) => s.limitOrder.expireIn);
  const onSetExpireIn = useCallback((value: number) => {
    backgroundApiProxy.dispatch(setExpireIn(value));
  }, []);

  return (
    <Box
      px="4"
      pb="4"
      pt="3"
      w="124px"
      backgroundColor="surface-subdued"
      ml="1"
      justifyContent="space-between"
    >
      <Typography.Body1 color="text-subdued" fontSize={12} fontWeight={500}>
        {intl.formatMessage({ id: 'form__expires_in' })}
      </Typography.Body1>
      <Select<number>
        title={intl.formatMessage({
          id: 'form__expires_in',
        })}
        isTriggerPlain
        footer={null}
        value={expireIn}
        defaultValue={expireIn}
        headerShown={false}
        options={options}
        dropdownProps={{ width: '64' }}
        dropdownPosition="right"
        renderTrigger={({ activeOption }) => (
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography.DisplayMedium>
              {formatExpireInString(activeOption.value)}
            </Typography.DisplayMedium>
            <Icon size={20} name="ChevronDownMini" />
          </Box>
        )}
        onChange={onSetExpireIn}
      />
    </Box>
  );
}

export function ParameterSetting() {
  const mktRate = useAppSelector((s) => s.limitOrder.mktRate);
  if (!mktRate) {
    return null;
  }
  return (
    <Box flexDirection="row" w="full" h="20" mt="1" overflow="hidden">
      <InstantRateSetting />
      <ExpireSetting />
    </Box>
  );
}
