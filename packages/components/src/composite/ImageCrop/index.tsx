/* eslint-disable spellcheck/spell-checker */
/* eslint-disable camelcase */
import { type ChangeEvent, useState } from 'react';

import { getEditorDefaults } from '@pqina/pintura';
import { PinturaEditorModal } from '@pqina/react-pintura';
import { withStaticProperties } from 'tamagui';

import { Portal } from '../../hocs';

import '@pqina/pintura/pintura.css';

import type { IOpenPickerFunc } from './type';

function BasicImageCrop({
  src,
  onConfirm,
  onClose,
}: {
  src: string;
  onConfirm: (image: string) => void;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(true);
  return visible ? (
    <PinturaEditorModal
      {...getEditorDefaults()}
      src={src}
      onClose={() => {
        setVisible(false);
        onClose();
      }}
      onProcess={(res) => {
        console.log(res.dest);
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const imageSrc = reader.result?.toString();
          if (imageSrc) {
            onConfirm(imageSrc);
          }
        });
        reader.readAsDataURL(res.dest);
      }}
    />
  ) : null;
}

const openPicker: IOpenPickerFunc = () =>
  new Promise((resolve) => {
    if (typeof document === 'undefined') {
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: Event) => {
      const event = e as unknown as ChangeEvent<HTMLInputElement>;
      // getting a hold of the file reference
      if (event.target.files && event.target?.files.length > 0) {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const imageSrc = reader.result?.toString();
          if (imageSrc) {
            const { destroy } = Portal.Render(
              Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
              <BasicImageCrop
                src={imageSrc}
                onConfirm={resolve as any}
                onClose={() => {
                  destroy();
                }}
              />,
            );
          }
        });
        reader.readAsDataURL(event.target.files[0]);
      }
    };
    input.click();
  });

export const ImageCrop = withStaticProperties(BasicImageCrop, {
  openPicker,
});
