import type { MoneroCoreInstance } from './moneroCoreTypes';

declare const instantiate: (importObj: any) => Promise<MoneroCoreInstance>;
export default instantiate;
