import * as safePass from '@onekeyfe/safe-pass';
import axios from 'axios';

import { REMOTE_URL, cmpVersion, parseVersion } from './base';

let verifiedList: string[] = [];
let maliciousListt: string[] = [];

function initDappSafePass(white: string[], black: string[]) {
  verifiedList = white;
  maliciousListt = black;
}

initDappSafePass(safePass.whitelist, safePass.blacklist);

async function syncDappSafePass(): Promise<void> {
  // from remote
  try {
    console.log('get remote safe pass...');
    const response = await axios.get<Record<string, any>>(
      `${REMOTE_URL}/safe_pass/list.json`,
    );
    const { data } = response;
    if (
      cmpVersion(parseVersion(data.version), parseVersion(safePass.version)) > 0
    ) {
      initDappSafePass(data.whitelist as string[], data.blacklist as string[]);
    }
  } catch (error) {
    console.error(error);
  }
}

function isSameDomainSuffix(domain: string, sub: string): boolean {
  if (domain === sub) return true;

  const domainParts: string[] = domain.split('.').reverse();
  const subParts: string[] = sub.split('.').reverse();

  if (domainParts.length < 2 || subParts.length < 2) return false;

  for (let i = 0; i < 2; i += 1) {
    if (domainParts[i] !== subParts[i]) return false;
  }

  return true;
}

function checkSafeDapp(dapp: string): 'unknown' | 'verified' | 'malicious' {
  let host: string;
  try {
    host = new URL(dapp).host;
  } catch (error) {
    host = dapp;
  }
  for (const domain of maliciousListt) {
    if (isSameDomainSuffix(domain, host)) return 'malicious';
  }
  for (const domain of verifiedList) {
    if (isSameDomainSuffix(domain, host)) return 'verified';
  }
  return 'unknown';
}

export { checkSafeDapp, syncDappSafePass };
