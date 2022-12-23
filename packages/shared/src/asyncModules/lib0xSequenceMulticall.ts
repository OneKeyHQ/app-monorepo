async function getModule() {
  // import { providers as multicall } from '@0xsequence/multicall';
  const module = await import('@0xsequence/multicall');
  return module.providers;
}

export default {
  getModule,
};
