export const useHoldersLayout = () => {
  const layoutConfig = {
    rank: {
      width: '$8',
    },
    address: {
      width: '$36',
    },
    amount: {
      width: '$20',
      textAlign: 'right' as const,
    },
    value: {
      flex: 1,
      textAlign: 'right' as const,
    },
  };

  return { layoutConfig };
};
