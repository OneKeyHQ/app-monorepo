export const useTransactionsLayoutNormal = () => {
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
      width: '$40',
    },
    value: {
      width: '$40',
    },
    address: {
      width: '$44',
    },
  };

  return { styles };
};
