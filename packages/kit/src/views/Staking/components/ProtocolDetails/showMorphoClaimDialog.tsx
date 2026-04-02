import { Dialog } from '@onekeyhq/components';

export function showMorphoClaimDialog({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
}) {
  return Dialog.show({
    title,
    description,
    onConfirm,
  });
}
