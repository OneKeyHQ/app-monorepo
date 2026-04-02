// @ts-ignore
/* eslint-disable */

const ethers = require('ethers');

// 1. Generate a new wallet
const wallet = ethers.Wallet.createRandom();
let result = '';

// 2. Create a transaction object
const transaction1 = {
  from: wallet.address,
  to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  value: ethers.utils.parseEther('0.2222'), // 0.1 ETH
  gasLimit: 21_000,
  maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'),
  maxPriorityFeePerGas: ethers.utils.parseUnits('5', 'gwei'),
  nonce: 0, // Assume this is the first transaction of the account
  type: 2, // EIP-1559 transaction type
  chainId: 1, // Mainnet
};

const transaction2 = {
  from: wallet.address,
  to: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  value: ethers.utils.parseEther('0.1111'), // 0.1 ETH
  gasLimit: 21_000,
  gasPrice: ethers.utils.parseUnits('20', 'gwei'), // Use gasPrice instead of EIP-1559 fee fields
  nonce: 0, // Assume this is the first transaction of the account
  chainId: 1, // Mainnet
};

function check(transaction) {
  result = `>>>>>>>>>>> New wallet address: ${wallet.address}\n\n`;

  // Print complete transaction details
  result += 'Transaction Details:\n';
  result += `From: ${transaction.from}\n`;
  result += `To: ${transaction.to}\n`;
  result += `Value: ${ethers.utils.formatEther(transaction.value)} ETH\n`;
  result += `Gas Limit: ${transaction.gasLimit}\n`;
  result += `Nonce: ${transaction.nonce}\n`;
  result += `Type: ${transaction.type}\n`;
  result += `Chain ID: ${transaction.chainId}\n\n`;

  // 3. Sign the transaction
  wallet.signTransaction(transaction).then((signedTx) => {
    result += `Signed transaction: ${signedTx}\n\n`;

    // 4. Extract signature components
    const tx = ethers.utils.parseTransaction(signedTx);
    const sig = {
      r: tx.r,
      s: tx.s,
      v: tx.v,
    };

    result += `Signature components:\n`;
    result += `r: ${sig.r}\n`;
    result += `s: ${sig.s}\n`;
    result += `v: ${sig.v}\n\n`;

    // 5. Calculate transaction hash
    const txClone = { ...tx };
    delete txClone.v;
    delete txClone.r;
    delete txClone.s;
    delete txClone.from;
    delete txClone.hash;
    const txHash = ethers.utils.keccak256(
      ethers.utils.serializeTransaction(txClone),
    );
    result += `Transaction hash: ${txHash}\n\n`;

    // 6. Verify if the recovered address matches the wallet address
    const recoveredAddress = ethers.utils.recoverAddress(txHash, sig);

    result += `Recovered address: ${recoveredAddress}\n`;
    result += `Wallet address: ${wallet.address}\n`;
    result += `Addresses match: ${String(
      recoveredAddress === wallet.address,
    )}\n\n`;

    console.log(result);

    result = '';
  });
}

check(transaction1);
setTimeout(() => {
  check(transaction2);
}, 1000);
