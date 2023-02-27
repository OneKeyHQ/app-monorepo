import type MoneroCoreInstance from './moneroCoreInstance';

declare const instantiate: (importObj: any) => Promise<MoneroCoreInstance>;
export default instantiate;
