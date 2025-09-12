import { useMedia } from '@onekeyhq/components';

export const useTransactionsLayoutNormal = () => {
  const media = useMedia();
  const isSmallScreen = !media.gt2xl;

  const styles = {
    time: {
      width: '$16',
    },
    type: {
      width: '$10',
    },
    amount: {
      width: 300,
      textAlign: 'center' as const,
    },
    price: {
      width: isSmallScreen ? '$80' : '$40',
      display: isSmallScreen ? ('none' as const) : ('flex' as const),
    },
    value: {
      width: isSmallScreen ? '$80' : '$40',
      display: isSmallScreen ? ('none' as const) : ('flex' as const),
    },
    priceValue: {
      width: '$32',
      display: isSmallScreen ? ('flex' as const) : ('none' as const),
    },
    address: {
      width: '$44',
    },
  };

  return { styles, isSmallScreen };
};
