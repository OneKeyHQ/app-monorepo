export const useHoldersLayoutNormal = () => {
  const styles = {
    rank: {
      width: '$10',
    },
    address: {
      width: 200,
    },
    percentage: {
      width: '$40',
      textAlign: 'right' as const,
    },
    amount: {
      width: '$40',
      textAlign: 'right' as const,
    },
    value: {
      width: '$40',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
