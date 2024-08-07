/* eslint-disable spellcheck/spell-checker */
/* eslint-disable camelcase */
import { type ChangeEvent, useCallback, useRef } from 'react';

import { Cropper } from 'react-mobile-cropper';
import 'react-mobile-cropper/dist/style.css';
import { withStaticProperties } from 'tamagui';

import { Dialog } from '../Dialog';

import {
  type IOpenPickerFunc,
  type IPickerImage,
  RESULT_MINE_TYPE,
} from './type';

import type { CropperRef } from 'react-mobile-cropper';

const MINE_TYPE = RESULT_MINE_TYPE;
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
  onConfirm: (data: IPickerImage) => void;
}) {
  const cropperRef = useRef<CropperRef>(null);

  const cropRectRef = useRef({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const onChange = useCallback((cropper: CropperRef) => {
    console.log(cropper);
    console.log(cropper.getCoordinates(), cropper.getCanvas());
    const coodrdinates = cropper.getCoordinates();
    if (coodrdinates) {
      const { top: y, width, height, left: x } = coodrdinates;
      cropRectRef.current = {
        x,
        y,
        height,
        width,
      };
    }
  }, []);

  return (
    <>
      <Cropper
        src={src}
        onChange={onChange}
        ref={cropperRef}
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
      <Dialog.Footer
        onConfirm={() => {
          if (cropperRef.current && cropperRef.current.getCanvas()) {
            const canvas = cropperRef.current.getCanvas();
            if (canvas) {
              const base64String = canvas.toDataURL(MINE_TYPE, 1.0);
              onConfirm({
                data: base64String,
                cropRect: cropRectRef.current,
                path: '',
                size: base64String.length,
                width: cropRectRef.current.width,
                height: cropRectRef.current.height,
                mime: MINE_TYPE,
              });
            }
          }
        }}
      />
    </>
  );
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
