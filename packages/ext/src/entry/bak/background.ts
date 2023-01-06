const Loader = async () => import('@emurgo/cardano-serialization-lib-browser');

const main = async () => {
  const CardanoWasm = await Loader();
  console.log('CardanoWasm', CardanoWasm);

  const magicProtocol = CardanoWasm.NetworkInfo.mainnet().protocol_magic();
  console.log('magicProtocol', magicProtocol);
};

main();

export default null;
