export const useHoldersLayoutSmall = () => {
  const styles = {
    rank: {
      width: '$10',
    },
    address: {
      flex: 1,
    },
    percentage: {
      width: '$4',
      textAlign: 'right' as const,
    },
    value: {
      width: '$24',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
