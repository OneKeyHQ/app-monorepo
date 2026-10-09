import { Fragment } from 'react';
import type { ReactNode } from 'react';

// Copy stays hardcoded English until it moves to Lokalise, but already in
// the shape the keys will take: whole sentences with named `{params}`, so
// swapping a template for `intl.formatMessage({ id }, values)` changes no
// call site logic. `formatMessage` takes React nodes as values the same way
// `renderCopy` does.
const PARAM_PATTERN = /\{(\w+)\}/g;

export function fillCopy(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(PARAM_PATTERN, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function renderCopy(
  template: string,
  values: Record<string, ReactNode>,
): ReactNode[] {
  return template.split(PARAM_PATTERN).map((part, index) => (
    // split() puts captured names at odd indexes.
    // oxlint-disable-next-line react/no-array-index-key
    <Fragment key={index}>{index % 2 === 1 ? values[part] : part}</Fragment>
  ));
}
