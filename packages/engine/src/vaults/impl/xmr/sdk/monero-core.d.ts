import type { MoneroCoreInstance } from './moneroTypes';

declare const instantiate: (importObj: any) => Promise<MoneroCoreInstance>;
export default instantiate;
