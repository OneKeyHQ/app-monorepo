/* eslint-disable max-classes-per-file */
// flowLogger.app.initSteps.loadHtml();
// flowLogger.app.initSteps.initNavitation();

import LoggerApp from './scopes/app';
import LoggerChain from './scopes/chain';
import LoggerError from './scopes/error';
import LoggerSend from './scopes/send';

class FlowLogger {
  app = new LoggerApp();

  chain = new LoggerChain();

  error = new LoggerError();

  send = new LoggerSend();

  // chain(flowLogger.chain.tx.broadcastTx)

  // overview(allNetwork, portfolio)
  // tx
  // token
  // nft
  // history

  // dapp(providerApi)
  // walletConnect

  // hardware

  // swap
  // discover
  // send
}

const flowLogger = new FlowLogger();

// TODO remove
flowLogger.app.init.loadHtml({ name: '1' });
flowLogger.app.init.loadHtml({ name: '2' });

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$flowLogger = flowLogger;
}

export default flowLogger;
