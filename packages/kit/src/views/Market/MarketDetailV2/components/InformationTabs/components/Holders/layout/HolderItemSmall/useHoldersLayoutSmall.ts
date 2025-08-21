export const useHoldersLayoutSmall = () => {
  const styles = {
    rank: {
      width: '$8',
    },
    address: {
      width: 170,
    },
    percentage: {
      width: '$14',
      textAlign: 'right' as const,
    },
    value: {
      width: '$18',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
