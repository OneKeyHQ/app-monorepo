export const useHoldersLayout = () => {
  const layoutConfig = {
    rank: {
      width: '$10',
    },
    address: {
      width: '$40',
    },
    amount: {
      width: '$40',
      textAlign: 'right' as const,
    },
    value: {
      width: '$40',
      textAlign: 'right' as const,
    },
    percentage: {
      width: '$40',
      textAlign: 'right' as const,
    },
  };

  return { layoutConfig };
};
