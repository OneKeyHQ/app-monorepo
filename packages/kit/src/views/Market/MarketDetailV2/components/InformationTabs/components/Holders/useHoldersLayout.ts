export const useHoldersLayout = () => {
  const layoutConfig = {
    rank: {
      width: '$8',
    },
    address: {
      width: '$32',
    },
    amount: {
      width: '$40',
      textAlign: 'right' as const,
    },
    value: {
      flex: 1,
      textAlign: 'right' as const,
    },
  };

  return { layoutConfig };
};
