import { format } from 'date-fns';

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
  return format(date, 'PPp') ?? '';
}
