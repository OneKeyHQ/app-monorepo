export function formatMonth(date: Date): string {
  const m = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const currentYear = new Date().getFullYear();
  const mn = date.getMonth();
  let key;
  if (currentYear === date.getFullYear()) {
    key = m[mn];
  } else {
    key = `${m[mn]}, ${date.getFullYear()}`;
  }
  return key;
}

export function formatDate(date: Date): string {
  const monthShrink = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const currentYear = new Date().getFullYear();
  const mn = date.getMonth();
  const M = date.getMonth() + 1;
  const h = date.getHours();
  const m = date.getMinutes();

  let key;
  if (currentYear === date.getFullYear()) {
    key = `${monthShrink[mn]} ${M.toString().padStart(2, '0')}, ${h
      .toString()
      .padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  } else {
    key = `${monthShrink[mn]} ${M.toString().padStart(
      2,
      '0',
    )}, ${date.getFullYear()}`;
  }
  return key;
}
