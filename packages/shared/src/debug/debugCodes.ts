const DEBUG_TX_HASH =
  '0x309bba6352410b5497d82d584e92ebb63984a14504956ee886c1fbf43e208901';

function breakpointCovalentTx({ txHash }: { txHash: string }) {
  if (process.env.NODE_ENV !== 'production') {
    if (txHash === DEBUG_TX_HASH) {
      debugger;
    }
  }
}

export default {
  breakpointCovalentTx,
};
