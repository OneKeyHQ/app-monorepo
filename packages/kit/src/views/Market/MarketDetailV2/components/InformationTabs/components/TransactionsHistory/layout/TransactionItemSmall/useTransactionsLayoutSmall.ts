export const useTransactionsLayoutSmall = () => {
  const styles = {
    time: {
      width: '$14',
    },
    amount: {
      flex: 1,
      textAlign: 'center' as const,
    },
    price: {
      textAlign: 'right' as const,
      width: '$30',
    },
  };

  return { styles };
};
