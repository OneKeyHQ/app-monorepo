export const useHoldersLayoutSmall = () => {
  const styles = {
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
