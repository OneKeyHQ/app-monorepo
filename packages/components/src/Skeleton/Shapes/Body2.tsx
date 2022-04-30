import React, { ComponentProps, FC } from 'react';

import { Rect } from 'react-content-loader/native';

type Body2Props = {
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
  width: 64,
  rounded: 6,
  x: 0,
  y: 4,
};

const Body2: FC<Body2Props> = ({ width, rounded, x, y, ...rest }) => (
  <Rect
    x={x}
    y={y}
    width={width}
    height="12"
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Body2.defaultProps = defaultProps;
export default Body2;
