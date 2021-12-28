import { format } from 'date-fns';

export function formatMonth(date: Date): string {
  const currentYear = new Date().getFullYear();
  if (currentYear === date.getFullYear()) {
    return format(date, 'MMMM') ?? '';
  }
  return format(date, 'MMMM, yyyy') ?? '';
}

export function formatDate(date: Date): string {
  return format(date, 'PPp') ?? '';
}
