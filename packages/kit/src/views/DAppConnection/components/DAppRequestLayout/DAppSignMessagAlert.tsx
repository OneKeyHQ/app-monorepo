import { Alert } from '@onekeyhq/components';

function DAppSignMessageAlert() {
  return (
    <Alert
      fullBleed
      type="critical"
      title="此类型的签名请求有时会被用于恶意目的，仅在您完全信任该网站时才签署。"
      icon="ErrorSolid"
      borderTopWidth={0}
    />
  );
}

export { DAppSignMessageAlert };
