export interface IThirdPartyAccountNameSourceAccount {
  name: string;
  address: string;
}

export interface IThirdPartyAccountNameTargetAccount {
  indexedAccountId: string;
  currentName: string;
  address: string;
}

export interface IAddressMatchedAccountName {
  indexedAccountId: string;
  currentName: string;
  sourceName: string;
  matchedAddress: string;
}

function normalizeAddress(address: string): string {
  const trimmed = address.trim();
  if (/^0x[0-9a-f]{40}$/i.test(trimmed) || /^(bc1|tb1)/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function matchAccountNamesByAddress({
  sourceAccounts,
  targetAccounts,
}: {
  sourceAccounts: IThirdPartyAccountNameSourceAccount[];
  targetAccounts: IThirdPartyAccountNameTargetAccount[];
}): IAddressMatchedAccountName[] {
  const sourceNamesByAddress = new Map<string, Set<string>>();
  for (const sourceAccount of sourceAccounts) {
    const address = normalizeAddress(sourceAccount.address);
    const name = sourceAccount.name.trim();
    if (address && name && name.length <= 80) {
      const names = sourceNamesByAddress.get(address) ?? new Set<string>();
      names.add(name);
      sourceNamesByAddress.set(address, names);
    }
  }

  const matchesByIndexedAccount = new Map<
    string,
    {
      currentName: string;
      matchedAddress: string;
      sourceNames: Set<string>;
    }
  >();
  for (const targetAccount of targetAccounts) {
    const address = normalizeAddress(targetAccount.address);
    const sourceNames = sourceNamesByAddress.get(address);
    if (address && sourceNames?.size === 1) {
      const match = matchesByIndexedAccount.get(
        targetAccount.indexedAccountId,
      ) ?? {
        currentName: targetAccount.currentName,
        matchedAddress: address,
        sourceNames: new Set<string>(),
      };
      match.sourceNames.add([...sourceNames][0]);
      matchesByIndexedAccount.set(targetAccount.indexedAccountId, match);
    }
  }

  return [...matchesByIndexedAccount.entries()].flatMap(
    ([indexedAccountId, match]) => {
      if (match.sourceNames.size !== 1) {
        return [];
      }
      const sourceName = [...match.sourceNames][0];
      if (sourceName === match.currentName) {
        return [];
      }
      return [
        {
          indexedAccountId,
          currentName: match.currentName,
          sourceName,
          matchedAddress: match.matchedAddress,
        },
      ];
    },
  );
}

// Trezor Suite's default Bitcoin title is derived from the account index.
// Account types (Legacy, Nested SegWit, Native SegWit, Taproot) intentionally
// reuse the same "Bitcoin #N" sequence.
export function getTrezorSuiteDefaultAccountTitleFromPath(
  path: string,
): string | undefined {
  const match = /^m\/(?:44|49|84|86)'\/0'\/(\d+)'(?:\/0\/0)?$/.exec(
    path.trim(),
  );
  if (!match) {
    return undefined;
  }
  const index = Number(match[1]);
  if (!Number.isSafeInteger(index) || index < 0 || index > 2_147_483_647) {
    return undefined;
  }
  return `Bitcoin #${index + 1}`;
}

export function getTrezorSuiteBtcReceivePath(path: string): string | undefined {
  const normalized = path.trim();
  if (/^m\/(?:44|49|84|86)'\/0'\/\d+'\/0\/0$/.test(normalized)) {
    return normalized;
  }
  if (/^m\/(?:44|49|84|86)'\/0'\/\d+'$/.test(normalized)) {
    return `${normalized}/0/0`;
  }
  return undefined;
}
