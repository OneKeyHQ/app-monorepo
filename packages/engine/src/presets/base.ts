import axios from 'axios';

const REMOTE_URL = 'https://onekey-asset.com/app_configs';

export type Version = {
  major: number;
  minor: number;
  patch: number;
};

function parseVersion(ver: string): Version {
  const parsed = ver.split('.');

  const v: Version = {
    major: +parsed[0],
    minor: +parsed[1],
    patch: +parsed[2],
  };
  return v;
}

export function fmtVersion(ver: Version): string {
  return `${ver.major}.${ver.minor}.${ver.patch}`;
}

function cmpVersion(v1: Version, v2: Version): number {
  const parsedX: number[] = [v1.major, v1.minor, v1.patch];
  const parsedY: number[] = [v2.major, v2.minor, v2.patch];
  for (let i = 0; i < 3; i += 1) {
    if (parsedX[i] > parsedY[i]) {
      return 1;
    }
    if (parsedX[i] < parsedY[i]) {
      return -1;
    }
  }
  return 0;
}

async function checkVersion(uri: string, ver: Version): Promise<string> {
  try {
    const response = await axios.get<string>(uri);
    if (cmpVersion(ver, parseVersion(response.data)) === -1) {
      return response.data;
    }
  } catch (error) {
    console.error(`check version of ${uri} fail`);
  }
  return '';
}

export { checkVersion, cmpVersion, parseVersion, REMOTE_URL };
