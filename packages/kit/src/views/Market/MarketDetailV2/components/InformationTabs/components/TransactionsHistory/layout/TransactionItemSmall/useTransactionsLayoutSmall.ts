export const useTransactionsLayoutSmall = () => {
  const styles = {
    time: {
      width: '$20',
    },
    amount: {
      flex: 1,
      textAlign: 'center' as const,
    },
    price: {
      textAlign: 'right' as const,
      width: '$32',
    },
  };

  return { styles };
};
