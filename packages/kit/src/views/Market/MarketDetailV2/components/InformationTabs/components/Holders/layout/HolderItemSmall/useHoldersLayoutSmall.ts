export const useHoldersLayoutSmall = () => {
  const styles = {
    rank: {
      width: '$10',
    },
    address: {
      width: 200,
    },
    percentage: {
      width: '$20',
      textAlign: 'right' as const,
    },
    value: {
      width: '$24',
      textAlign: 'right' as const,
    },
  };

  return { styles };
};
