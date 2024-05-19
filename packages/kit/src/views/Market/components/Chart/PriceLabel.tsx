import BigNumber from 'bignumber.js';

import {
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

type IPriceLabelProps = {
  price: number | null;
  basePrice: number;
  time: string;
};

function formatMarketValueForFiexd(value?: number, fractionDigits?: number) {
  if (value) {
    // const resValue = fractionDigits
    //   ? value.toFixed(fractionDigits).replace(/0+$/g, '')
    //   : value.toFixed(2).replace(/0+$/g, '');

    return fractionDigits ? value.toFixed(fractionDigits) : value.toFixed(2);
  }
  return '0.00';
}
function parseExponential(value?: number) {
  if (!value) return 0;
  const e = /\d(?:\.(\d*))?e([+-]\d+)/.exec(value.toExponential());
  return e
    ? value.toFixed(Math.max(0, (e[1] || '').length - parseInt(e[2])))
    : value;
}

function formatDecimalZero(value: number) {
  if (value >= 1) return formatMarketValueForFiexd(value);
  const noRexponentail = parseExponential(value);
  const effectIndex = noRexponentail.toString().search(/[^-.0]/g);
  const zeroCount = effectIndex - 2;
  const fiexdValue = formatMarketValueForFiexd(value, 3 + zeroCount);
  if (zeroCount >= 3) {
    return `0.{${zeroCount}}${fiexdValue.toString().substring(effectIndex)}`;
  }
  return fiexdValue;
}

function calculateGains({
  basePrice,
  price,
}: {
  basePrice?: number;
  price?: number | string | null;
}) {
  let gainTextColor = '$textSubdued';

  const priceNum = new BigNumber(
    typeof price === 'string' ? +price : price ?? 0,
  );

  const gain = priceNum.minus(basePrice ?? 0);

  if (priceNum.isNaN() || gain.isNaN()) {
    return {
      gain: 0,
      gainNumber: 0,
      gainText: '0.00',
      percentageGain: '0.00%',
      isPositive: false,
      gainTextColor,
    };
  }
  const gainNumber = gain.toNumber();
  const isPositive = gainNumber >= 0;
  let percentageGain: number | string = basePrice
    ? gain.dividedBy(basePrice).multipliedBy(100).toNumber()
    : 0;
  const gainText = isPositive
    ? `+${formatDecimalZero(gainNumber)}`
    : formatDecimalZero(gainNumber);

  percentageGain = isPositive
    ? `+${percentageGain.toFixed(2)}%`
    : `${percentageGain.toFixed(2)}%`;

  if (!isPositive) {
    gainTextColor = '$textCritical';
  } else {
    gainTextColor = '$textSuccess';
  }

  return {
    gain,
    gainNumber,
    gainText,
    gainTextColor,
    percentageGain,
    isPositive,
  };
}

export function PriceLabel({ price, basePrice, time }: IPriceLabelProps) {
  let displayInfo;
  if (price !== null) {
    const { gainText, percentageGain, gainTextColor } = calculateGains({
      basePrice,
      price,
    });
    displayInfo = (
      <>
        <SizableText size="$bodyMdMedium" color={gainTextColor}>
          {gainText}({percentageGain})
        </SizableText>
        <SizableText size="$bodyMdMedium" color="$textSubdued" ml={8}>
          {time}
        </SizableText>
      </>
    );
  } else {
    displayInfo = (
      <SizableText size="$bodyMdMedium" color="$textSubdued" ml={8}>
        +0.00(+0.00%)
      </SizableText>
    );
  }
  // const { selectedFiatMoneySymbol } = useSettings();
  return (
    <YStack>
      <NumberSizeableText
        size="$heading3xl"
        formatter="price"
        formatterOptions={{ currency: '$' }}
      >
        {String(price)}
      </NumberSizeableText>
      <XStack mt={4} alignItems="center">
        {displayInfo}
      </XStack>
    </YStack>
  );
}
