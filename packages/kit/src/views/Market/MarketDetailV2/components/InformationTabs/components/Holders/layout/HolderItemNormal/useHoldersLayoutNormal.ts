export const useHoldersLayoutNormal = () => {
  const styles = {
    rank: {
      width: '5%',
      minWidth: 40,
    },
    address: {
      width: '20%',
      minWidth: 200,
    },
    percentage: {
      width: '25%',
      textAlign: 'right' as const,
    },
    amount: {
      width: '25%',
      textAlign: 'right' as const,
    },
    value: {
      width: '25%',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
