import type { IMoneroCoreInstance } from './moneroCoreTypes';

declare const instantiate: (importObj: any) => Promise<IMoneroCoreInstance>;
export default instantiate;
