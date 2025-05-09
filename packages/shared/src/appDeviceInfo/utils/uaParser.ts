import { UAParser } from 'ua-parser-js';

export async function getUAParserResult(): Promise<UAParser.IResult> {
  const uap = new UAParser();
  const result: UAParser.IResult = uap.getResult();
  // await navigator.userAgentData.getHighEntropyValues(['brands', 'fullVersionList', 'mobile', 'model', 'platform', 'platformVersion', 'architecture', 'formFactors', 'bitness'])
  await result.withFeatureCheck();
  await result.withClientHints();

  return result;
}
