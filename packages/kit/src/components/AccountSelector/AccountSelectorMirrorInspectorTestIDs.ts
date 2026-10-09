import testIDValues from './AccountSelectorMirrorInspectorTestIDValues.json';

const {
  copyAddressPrefix,
  findingsPrefix,
  findingsTogglePrefix,
  instancePrefix,
  revealAddressPrefix,
  slotPrefix,
  ...staticTestIDs
} = testIDValues;

export const AccountSelectorMirrorInspectorTestIDs = {
  ...staticTestIDs,
  copyAddress: (instanceId: number, num: number) =>
    `${copyAddressPrefix}${instanceId}-${num}`,
  findings: (instanceId: number, num: number) =>
    `${findingsPrefix}${instanceId}-${num}`,
  findingsToggle: (instanceId: number, num: number) =>
    `${findingsTogglePrefix}${instanceId}-${num}`,
  instance: (instanceId: number) => `${instancePrefix}${instanceId}`,
  revealAddress: (instanceId: number, num: number) =>
    `${revealAddressPrefix}${instanceId}-${num}`,
  slot: (instanceId: number, num: number) =>
    `${slotPrefix}${instanceId}-${num}`,
} as const;
