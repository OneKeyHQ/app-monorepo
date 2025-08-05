export const useHoldersLayoutSmall = () => {
  const styles = {
    rank: {
      width: '$10',
    },
    address: {
      flex: 1,
    },
    percentage: {
      width: '$20',
      textAlign: 'right' as const,
    },
    value: {
      width: '$28',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
