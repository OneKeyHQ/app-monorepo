# Use Gas Account to Pay Network Fees

When sending tokens on-chain, you usually need the network's native token to pay network fees. For example, sending USDC on Ethereum normally requires ETH for network fees. Sending USDC on Arbitrum also requires ETH on Arbitrum to pay network fees.

Gas Account is a network fee payment feature provided by OneKey. When a transaction is eligible, OneKey can use Gas Account to handle the network fee, so you may still be able to complete a token transfer even if you do not have enough native token in your wallet.

At this stage, Gas Account network fees are sponsored by OneKey. You do not need to pay an extra network fee for eligible Gas Account transactions.

If the current transaction supports Gas Account, you may see a message like this on the transaction confirmation page:

```text
OneKey Sponsored
Saved ~$0.04 · You pay 0 network fee
```

This means OneKey sponsors the network fee for this transaction, and you do not need to pay an extra network fee for it.

## When is Gas Account available?

Gas Account availability is checked automatically based on the network, transaction type, network fee level, and service status. It is not available for every network or every transaction.

If a transaction supports Gas Account, OneKey will show the related message on the transaction confirmation page. If the message does not appear, the transaction needs to use the standard network fee flow.

## Who can use Gas Account?

At this stage, you do not need to apply for Gas Account or add funds to it. You may be able to use OneKey-sponsored Gas Account when all of the following conditions are met:

- You are using a OneKey App version that supports Gas Account.
- `Prefer Gas Account` is enabled in app settings. This setting is enabled by default. If you turn it off, eligible transactions will not prioritize Gas Account.
- You are using a currently supported network and module.
- The transaction meets Gas Account sponsorship rules, such as transaction type, network fee level, and service status.

Please refer to whether the transaction confirmation page shows `OneKey Sponsored` or `Send free`.

## Supported Networks and Transaction Types

The following mainnets are supported:

- Ethereum Mainnet
- BSC
- Arbitrum

Gas Account supports eligible transactions in the following modules:

- Standard transfers: eligible single-token transfers on supported networks, such as USDC.

Bulk Send, Swap, Perps, Earn, and dApp interaction flows are not part of the formally supported Gas Account scope at this stage. If support changes later, please refer to the actual message shown on the transaction confirmation page. If no Gas Account message appears, the transaction needs to use the standard network fee flow.

Supported networks and transaction types may change as the product rolls out. Please refer to the actual message shown on the transaction confirmation page.

## How to use Gas Account

You do not need to apply for Gas Account or enter any extra information manually. OneKey checks whether Gas Account can be used when you reach the transaction confirmation page.

Steps:

1. Start a transfer in OneKey App.
2. Go to the transaction confirmation page.
3. Review the recipient address, amount, and network.
4. If the page shows `OneKey Sponsored` or `Send free`, the transaction can use Gas Account.
5. Confirm the details, sign, and send the transaction.

If the transaction does not support Gas Account, the app will show the network fee you need to pay.

## What will I see on-chain after using Gas Account?

When Gas Account is used, you may see a OneKey-related network fee transaction and your own signed transfer transaction on-chain.

This is expected. You only need to check whether your own transfer is completed.

## Does Gas Account affect my asset security?

No.

Gas Account only handles the network fee for eligible transactions. It does not change the recipient address, transfer amount, or transaction content.

You still need to carefully review the transaction details on the confirmation page. The transaction will only be sent after you sign it.

## FAQ

### Are all transactions free with Gas Account?

No. Gas Account only applies to eligible transactions. Please refer to the transaction confirmation page.

### What should I do if the transaction fails?

A failed transaction does not mean your assets are lost. You can first check the transaction status in transaction history or on a block explorer.

If the confirmation page showed `You pay 0 network fee`, OneKey handled the network fee for that transaction. You do not need to prepare extra native token for that transaction's network fee.

If the confirmation page did not show a Gas Account message, the transaction follows the standard network fee flow.

### Can I turn Gas Account on or off manually?

If Gas Account settings are available in the app, you can adjust them based on your preference. When enabled, eligible transactions will prioritize Gas Account for network fees.

### How is Gas Account different from standard network fees?

With standard network fees, the fee is usually paid from your wallet balance. With Gas Account, OneKey can handle the network fee for eligible transactions, reducing the need to prepare extra native tokens just to pay network fees.

### Will the transaction take longer to confirm?

Possibly.

Because Gas Account needs to handle the network fee separately, sponsored transactions may take longer to confirm on-chain than standard transactions. Please wait for the on-chain confirmation.

If the transaction takes a long time to complete, you can check its status in transaction history or on a block explorer, or try again later.

### What should I keep in mind when using Gas Account?

- Gas Account only handles network fees for eligible transactions. It does not guarantee that the transaction itself will succeed.
- Even when OneKey handles the network fee, you should still verify the recipient address, amount, and network.
- Sponsored transactions may take longer to confirm on-chain.
- If no Gas Account message appears, please prepare the network fee as you would for a standard transaction.
