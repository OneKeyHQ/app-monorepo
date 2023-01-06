const Loader = async () => import('@emurgo/cardano-serialization-lib-browser');
const main = async () => {
  const CardanoWasm = await Loader();
  console.log('CardanoWasm', CardanoWasm);

  console.log(
    'CardanoWasm.NetworkInfo.mainnet',
    // eslint-disable-next-line @typescript-eslint/unbound-method
    CardanoWasm.NetworkInfo.mainnet,
  );

  const magicProtocol = CardanoWasm.NetworkInfo.mainnet().protocol_magic();
  console.log('magicProtocol', magicProtocol);
};

main();

export default null;
