import type { IMoneroUtilInstance } from './moneroUtilTypes';

declare const instantiate: (importObj: any) => Promise<IMoneroUtilInstance>;
export default instantiate;
