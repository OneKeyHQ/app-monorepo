import { utils } from 'ethers';
import stringify from 'fast-json-stable-stringify';

import type { IIpTableRemoteConfig } from '../request/types/ipTable';

const EXPECTED_SIGNER_ADDRESS = '0x3eaf57d1aD767CA3aFeDbF8D82C1De610c6F6519';

export function verifyIpTableConfigSignature(
  config: IIpTableRemoteConfig,
): boolean {
  try {
    const { signature, ...dataToVerify } = config;

    if (!signature) {
      console.error(
        '[IpTableUtils] Signature verification failed: Missing signature',
      );
      return false;
    }

    const canonicalString = stringify(dataToVerify);

    const recoveredAddress = utils.verifyMessage(canonicalString, signature);

    const isValid =
      recoveredAddress.toLowerCase() === EXPECTED_SIGNER_ADDRESS.toLowerCase();

    if (!isValid) {
      console.error(
        '[IpTableUtils] Signature verification failed: Invalid signer',
        '\n  Expected:',
        EXPECTED_SIGNER_ADDRESS,
        '\n  Recovered:',
        recoveredAddress,
      );
    }

    return isValid;
  } catch (error) {
    console.error('[IpTableUtils] Signature verification error:', error);
    return false;
  }
}

export function mergeIpTableConfigs(
  localConfig: IIpTableRemoteConfig,
  remoteConfig: IIpTableRemoteConfig,
): IIpTableRemoteConfig {
  const mergedDomains = { ...localConfig.domains };

  for (const [domain, remoteDomainConfig] of Object.entries(
    remoteConfig.domains,
  )) {
    if (mergedDomains[domain]) {
      const localEndpoints = mergedDomains[domain].endpoints;
      const remoteEndpoints = remoteDomainConfig.endpoints;

      const existingIps = new Set(localEndpoints.map((ep) => ep.ip));

      const newEndpoints = remoteEndpoints.filter(
        (ep) => !existingIps.has(ep.ip),
      );

      mergedDomains[domain] = {
        endpoints: [...localEndpoints, ...newEndpoints],
      };
    } else {
      mergedDomains[domain] = remoteDomainConfig;
    }
  }

  return {
    version: remoteConfig.version,
    ttl_sec: remoteConfig.ttl_sec,
    generated_at: remoteConfig.generated_at,
    signature: remoteConfig.signature,
    domains: mergedDomains,
  };
}
