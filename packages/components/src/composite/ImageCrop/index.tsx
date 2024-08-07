/* eslint-disable spellcheck/spell-checker */
/* eslint-disable camelcase */
import { type ChangeEvent, useCallback, useState } from 'react';

import { Cropper } from 'react-mobile-cropper';
import 'react-mobile-cropper/dist/style.css';
import { withStaticProperties } from 'tamagui';

import { Portal } from '../../hocs';
import { Stack } from '../../primitives';
import { Dialog } from '../Dialog';

import type { IOpenPickerFunc } from './type';
import type { CropperProps, CropperRef } from 'react-mobile-cropper';

function BasicImageCrop({
  src,
  onConfirm,
  defaultSize,
}: {
  src: string;
  defaultSize: {
    height: number;
    width: number;
  };
  onConfirm: (image: string) => void;
}) {
  const onChange = useCallback((cropper: CropperRef) => {
    console.log(cropper);
    console.log(cropper.getCoordinates(), cropper.getCanvas());
  }, []);

  return visible ? (
    <Cropper
      src={src}
      onChange={onChange}
      stencilProps={{
        aspectRatio: defaultSize.width / defaultSize.height,
      }}
      className="cropper"
      // onProcess={(res) => {
      //   console.log(res.dest);
      //   const reader = new FileReader();
      //   reader.addEventListener('load', () => {
      //     const imageSrc = reader.result?.toString();
      //     if (imageSrc) {
      //       onConfirm(imageSrc);
      //     }
      //   });
      //   reader.readAsDataURL(res.dest);
      // }}
    />
  ) : null;
}

const openPicker: IOpenPickerFunc = ({ width, height }) =>
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
            Dialog.show({
              title: 'Crop Image',
              sheetProps: {
                disableDrag: true,
              },
              renderContent: (
                <BasicImageCrop
                  src={imageSrc}
                  defaultSize={{
                    width,
                    height,
                  }}
                  onConfirm={resolve as any}
                />
              ),
            });
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
