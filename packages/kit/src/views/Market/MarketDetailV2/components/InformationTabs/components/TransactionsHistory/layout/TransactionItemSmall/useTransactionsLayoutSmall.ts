export const useTransactionsLayoutSmall = () => {
  const styles = {
    time: {
      width: '20%',
    },
    amount: {
      width: '55%',
      textAlign: 'center' as const,
    },
    price: {
      width: '25%',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
