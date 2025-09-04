export const calcCellAlign = (align?: string) => {
  if (align === 'left') {
    return 'flex-start';
  }
  if (align === 'right') {
    return 'flex-end';
  }
  return 'center';
};
