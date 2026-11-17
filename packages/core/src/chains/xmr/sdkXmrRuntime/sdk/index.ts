// Node and Jest only, so no Worker: every app build picks an index.*.ts file.
export { loadXmrRuntime as getXmrRuntimeApiForCarrier } from '../carrier/loadRuntime';
