export const useHoldersLayout = () => {
  const layoutConfig = {
    rank: {
      width: '$8',
    },
    address: {
      width: '$50',
    },
    amount: {
      width: '$18',
      textAlign: 'right' as const,
    },
    value: {
      width: '$16',
      textAlign: 'right' as const,
    },
    percentage: {
      width: '$16',
      textAlign: 'right' as const,
    },
  };

  return { layoutConfig };
};
