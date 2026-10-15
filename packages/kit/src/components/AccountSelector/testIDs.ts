import testIDValues from './testIDValues.json';

const {
  addressTypeSelectorItemPrefix,
  deriveTypeSelectorTriggerPrefix,
  ...staticTestIDs
} = testIDValues;

export const AccountSelectorTestIDs = {
  ...staticTestIDs,
  addressTypeSelectorItem: (deriveType: string) =>
    `${addressTypeSelectorItemPrefix}${deriveType}`,
  deriveTypeSelectorTrigger: (pathTemplate: string) =>
    `${deriveTypeSelectorTriggerPrefix}${pathTemplate}`,
} as const;
