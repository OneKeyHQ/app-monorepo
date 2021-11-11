/* eslint-disable no-undef */
import { screen } from 'electron';

// Constants
export const MIN_WIDTH = 770;
export const MIN_HEIGHT = 700;
export const MAX_WIDTH = 1920;
export const MAX_HEIGHT = 1080;
export const BUFFER = 0.2;

// Functions
export const getInitialWindowSize = (): WinBounds => {
  const { bounds } = screen.getPrimaryDisplay();

  const buffer = {
    width: bounds.width * BUFFER,
    height: bounds.height * BUFFER,
  };

  let width = bounds.width - buffer.width;
  if (width <= MIN_WIDTH) {
    width = MIN_WIDTH;
  } else if (width >= MAX_WIDTH) {
    width = MAX_WIDTH;
  }

  let height = bounds.height - buffer.height;
  if (height <= MIN_HEIGHT) {
    height = MIN_HEIGHT;
  } else if (height >= MAX_HEIGHT) {
    height = MAX_HEIGHT;
  }

  return {
    width,
    height,
  };
};
