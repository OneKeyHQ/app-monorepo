export const useHoldersLayoutSmall = () => {
  const styles = {
    rank: {
      width: '$6',
    },
    address: {
      width: 170,
    },
    percentage: {
      width: '$14',
      textAlign: 'right' as const,
    },
    value: {
      width: '$20',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
