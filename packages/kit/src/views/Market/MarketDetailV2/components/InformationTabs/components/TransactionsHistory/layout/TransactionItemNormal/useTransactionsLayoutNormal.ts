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
      width: '35%',
      minWidth: 300,
      textAlign: 'center' as const,
    },
    price: {
      width: isSmallScreen ? '$80' : '20%',
      display: isSmallScreen ? ('none' as const) : ('flex' as const),
    },
    value: {
      width: isSmallScreen ? '$80' : '20%',
      display: isSmallScreen ? ('none' as const) : ('flex' as const),
    },
    priceValue: {
      minWidth: '$32',
      width: '20%',
      display: isSmallScreen ? ('flex' as const) : ('none' as const),
    },
    address: {
      width: '10%',
      minWidth: '$44',
    },
  };

  return { styles, isSmallScreen };
};
