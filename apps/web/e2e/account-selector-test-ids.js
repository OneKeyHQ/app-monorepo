const assert = require('node:assert/strict');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const accountSelectorTestIDValues = require(
  path.join(
    repoRoot,
    'packages/kit/src/components/AccountSelector/testIDValues.json',
  ),
);
const accountManagerTestIDValues = require(
  path.join(
    repoRoot,
    'packages/kit/src/views/AccountManagerStacks/testIDValues.json',
  ),
);
const addressInputTestIDValues = require(
  path.join(
    repoRoot,
    'packages/kit/src/components/AddressInput/testIDValues.json',
  ),
);
const dappConnectionTestIDValues = require(
  path.join(
    repoRoot,
    'packages/kit/src/views/DAppConnection/testIDValues.json',
  ),
);
const marketTestIDValues = require(
  path.join(repoRoot, 'packages/kit/src/views/Market/testIDValues.json'),
);
const sendTestIDValues = require(
  path.join(repoRoot, 'packages/kit/src/views/Send/testIDValues.json'),
);

const {
  addressTypeSelectorItemPrefix,
  deriveTypeSelectorTriggerPrefix,
  ...accountSelectorStaticTestIDs
} = accountSelectorTestIDValues;
const {
  accountEditButtonPrefix,
  accountItemPrefix,
  exportMnemonicKeyPrefix,
  exportPrivateKeyPrefix,
  exportPublicKeyPrefix,
  walletEditButtonPrefix,
  walletPrefix,
  ...accountManagerStaticTestIDs
} = accountManagerTestIDValues;

const AccountSelectorTestIDs = Object.freeze({
  ...accountSelectorStaticTestIDs,
  addressTypeSelectorItem: (deriveType) =>
    `${addressTypeSelectorItemPrefix}${deriveType}`,
  deriveTypeSelectorTrigger: (pathTemplate) =>
    `${deriveTypeSelectorTriggerPrefix}${pathTemplate}`,
});
const AccountManagerTestIDs = Object.freeze({
  ...accountManagerStaticTestIDs,
  accountEditButton: (name) => `${accountEditButtonPrefix}${name}`,
  accountItem: (index) => `${accountItemPrefix}${index}`,
  exportMnemonicKey: (name) => `${exportMnemonicKeyPrefix}${name}`,
  exportPrivateKey: (name) => `${exportPrivateKeyPrefix}${name}`,
  exportPublicKey: (name) => `${exportPublicKeyPrefix}${name}`,
  wallet: (walletId) => `${walletPrefix}${walletId}`,
  walletEditButton: (name) => `${walletEditButtonPrefix}${name}`,
});
const DAppConnectionTestIDs = Object.freeze({
  ...dappConnectionTestIDValues,
});
const AddressInputTestIDs = Object.freeze({
  ...addressInputTestIDValues,
});
const MarketTestIDs = Object.freeze({
  ...marketTestIDValues,
});
const { recipientItemPrefix, ...sendStaticTestIDs } = sendTestIDValues;
const SendTestIDs = Object.freeze({
  ...sendStaticTestIDs,
  recipientItem: (address) => `${recipientItemPrefix}${address}`,
});

function assertUniqueStaticTestIDs(testIDGroups) {
  const ownersByValue = new Map();
  for (const [groupName, testIDs] of Object.entries(testIDGroups)) {
    for (const [name, value] of Object.entries(testIDs)) {
      if (typeof value === 'string') {
        const owners = ownersByValue.get(value) || [];
        owners.push(`${groupName}.${name}`);
        ownersByValue.set(value, owners);
      }
    }
  }

  const duplicates = [...ownersByValue.entries()].filter(
    ([, owners]) => owners.length > 1,
  );
  assert.deepEqual(
    duplicates,
    [],
    `Duplicate static testIDs: ${JSON.stringify(duplicates)}`,
  );
}

assertUniqueStaticTestIDs({
  AccountManagerTestIDs,
  AccountSelectorTestIDs,
  AddressInputTestIDs,
  DAppConnectionTestIDs,
  MarketTestIDs,
  SendTestIDs,
});

module.exports = {
  AccountManagerTestIDs,
  AccountSelectorTestIDs,
  AddressInputTestIDs,
  DAppConnectionTestIDs,
  MarketTestIDs,
  SendTestIDs,
  assertUniqueStaticTestIDs,
};
