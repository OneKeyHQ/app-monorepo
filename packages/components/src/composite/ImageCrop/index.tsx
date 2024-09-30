/* eslint-disable spellcheck/spell-checker */
/* eslint-disable camelcase */
import { type ChangeEvent, useCallback, useRef, useState } from 'react';

import { Cropper } from 'react-mobile-cropper';
import 'react-mobile-cropper/dist/style.css';
import { withStaticProperties } from 'tamagui';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { Stack } from '../../primitives';
import { Dialog } from '../Dialog';

import {
  type IOpenPickerFunc,
  type IPickerImage,
  RESULT_MINE_TYPE,
} from './type';

import type { IStackStyle } from '../../primitives';
import type { CropperRef } from 'react-mobile-cropper';
import type { LayoutChangeEvent } from 'react-native';

const MINE_TYPE = RESULT_MINE_TYPE;
const resizeImage = (
  imgSrc: string,
  width: number,
  height: number,
): Promise<string> =>
  new Promise((resolve) => {
    const img = document.createElement('img');

    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataURI = canvas.toDataURL(MINE_TYPE, 1.0);
        resolve(dataURI);
      }
    });
    img.src = imgSrc;
  });

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

  useState<IStackStyle['width']>('100%');
  const onStackLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    if (nativeEvent.layout.width) {
      setTimeout(() => {
        cropperRef.current?.reset();
      }, 300);
    }
  }, []);

  const onChange = useCallback((cropper: CropperRef) => {
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
      <Stack
        onLayout={onStackLayout}
        $gtMd={{ height: 'calc(100vh - 180px)' }}
        height="calc(100vh - 172px)"
      >
        <Cropper
          src={src}
          onChange={onChange}
          ref={cropperRef}
          stencilProps={{
            aspectRatio: defaultSize.width / defaultSize.height,
          }}
          className="onekey-img-cropper"
        />
      </Stack>
      <Dialog.Footer
        onConfirm={async () => {
          if (cropperRef.current && cropperRef.current.getCanvas()) {
            const canvas = cropperRef.current.getCanvas();
            if (canvas) {
              const { width, height } = defaultSize;
              const imageWidth = cropRectRef.current.width;
              const imageHeight = cropRectRef.current.height;
              let base64String = canvas.toDataURL(MINE_TYPE, 1.0);
              if (imageHeight > height || imageWidth > width) {
                base64String = await resizeImage(base64String, width, height);
              }
              onConfirm({
                data: base64String,
                cropRect: cropRectRef.current,
                path: '',
                size: base64String.length,
                width: Math.min(imageWidth, width),
                height: Math.min(imageHeight, height),
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
              title: appLocale.intl.formatMessage({
                id: ETranslations.global_crop_image,
              }),
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
