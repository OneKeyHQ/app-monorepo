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

export function formatDate(date: Date, containsYear = false): string {
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
  const M = (date.getMonth() + 1).toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');

  let key;
  if (currentYear !== date.getFullYear() || containsYear) {
    key = `${monthShrink[mn]} ${M} ${date.getFullYear()}, ${h}:${m}`;
  } else {
    key = `${monthShrink[mn]} ${M}, ${h}:${m}`;
  }
  return key;
}
