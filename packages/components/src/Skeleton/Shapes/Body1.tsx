import React, { ComponentProps, FC } from 'react';

import { Rect } from 'react-content-loader/native';

type Body1Props = {
  /* 
    width of the svg.
  */
  width?: number | string;
  /* 
    border radius
  */
  rounded?: number | string;
  /*
    x position
  */
  x?: number | string;
  /* 
    y position
  */
  y?: number | string;
} & ComponentProps<typeof Rect>;

const defaultProps = {
  width: 80,
  rounded: 7,
  x: 0,
  y: 5,
};

const Body1: FC<Body1Props> = ({ width, rounded, x, y, ...rest }) => (
  <Rect
    x={x}
    y={y}
    width={width}
    height="14"
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Body1.defaultProps = defaultProps;
export default Body1;
