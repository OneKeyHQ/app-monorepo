export * from './pages/SendDataInput/SendDataInputContainer';

// TODO(6.7.0): Remove this legacy SendModal confirmation export.
// Active confirmation flows use SignatureConfirmModal -> TxConfirm.
export {
  SendConfirmContainer as SendConfirm,
  SendConfirmContainerWithProvider as SendConfirmWithProvider,
} from './pages/SendConfirm/SendConfirmContainer';
