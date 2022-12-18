import type { ComponentProps, FC } from 'react';

import { Circle, Rect } from 'react-content-loader/native';

/* 
  Props for the shapes of typography
*/
type TextShapeProps = {
  /* 
    width of the Rect.
  */
  width?: number | string;
  /* 
    height of the Rect.
  */
  height?: number | string;
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

/*
  Display2XLarge
*/
type Display2XLargeProps = TextShapeProps;

const Display2XLargeDefaultProps = {
  width: 146,
  height: 20,
  rounded: 4,
  x: 0,
  y: 0,
} as const;

const Display2XLarge: FC<Display2XLargeProps> = ({
  width,
  height,
  rounded,
  x,
  y,
  ...rest
}) => (
  <Rect
    x={x}
    y={Number(y) + 9}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Display2XLarge.defaultProps = Display2XLargeDefaultProps;

/*
  DisplayXLarge
*/
type DisplayXLargeProps = TextShapeProps;

const DisplayXLargeDefaultProps = {
  width: 128,
  height: 18,
  rounded: 4,
  x: 0,
  y: 0,
} as const;

const DisplayXLarge: FC<DisplayXLargeProps> = ({
  width,
  height,
  rounded,
  x,
  y,
  ...rest
}) => (
  <Rect
    x={x}
    y={Number(y) + 9}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

DisplayXLarge.defaultProps = DisplayXLargeDefaultProps;

/*
  PageHeading
*/
type PageHeadingProps = TextShapeProps;

const PageHeadingDefaultProps = {
  width: 112,
  height: 16,
  rounded: 4,
  x: 0,
  y: 0,
} as const;

const PageHeading: FC<PageHeadingProps> = ({
  width,
  height,
  rounded,
  x,
  y,
  ...rest
}) => (
  <Rect
    x={x}
    y={Number(y) + 8}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

PageHeading.defaultProps = PageHeadingDefaultProps;

/*
  Heading
*/
type HeadingProps = TextShapeProps;

const HeadingDefaultProps = {
  width: 96,
  height: 14,
  rounded: 4,
  x: 0,
  y: 0,
} as const;

const Heading: FC<HeadingProps> = ({
  width,
  height,
  rounded,
  x,
  y,
  ...rest
}) => (
  <Rect
    x={x}
    y={Number(y) + 7}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Heading.defaultProps = HeadingDefaultProps;

/*
  Body1
*/
type Body1Props = TextShapeProps;

const Body1DefaultProps = {
  width: 80,
  height: 12,
  rounded: 4,
  x: 0,
  y: 0,
} as const;

const Body1: FC<Body1Props> = ({ width, height, rounded, x, y, ...rest }) => (
  <Rect
    x={x}
    y={Number(y) + 6}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Body1.defaultProps = Body1DefaultProps;

/* 
  Body2
*/
type Body2Props = TextShapeProps;

const Body2DefaultProps = {
  width: 64,
  height: 10,
  rounded: 4,
  x: 0,
  y: 0,
};

const Body2: FC<Body2Props> = ({ width, height, rounded, x, y, ...rest }) => (
  <Rect
    x={x}
    y={Number(y) + 5}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Body2.defaultProps = Body2DefaultProps;

/* 
  Avatar
*/
type AvatarProps = {
  /* 
    The x-axis coordinate of the center of the circle.
  */
  cx?: number | string;
  /* 
    The y-axis coordinate of the center of the circle.
  */
  cy?: number | string;
  /* 
    The y-axis coordinate of the center of the circle.
  */
  r?: number | string;
} & ComponentProps<typeof Circle>;

const AvatarDefaultProps = {
  cx: 16,
  cy: 16,
  r: 16,
};

const Avatar: FC<AvatarProps> = ({ cx, cy, r, ...rest }) => (
  <Circle cx={cx} cy={cy} r={r} {...rest} />
);

Avatar.defaultProps = AvatarDefaultProps;

/* 
  Caption
*/
type CaptionProps = TextShapeProps;

const CaptionDefaultProps = {
  width: 48,
  height: 8,
  rounded: 4,
  x: 0,
  y: 0,
};

const Caption: FC<CaptionProps> = ({
  width,
  height,
  rounded,
  x,
  y,
  ...rest
}) => (
  <Rect
    x={x}
    y={Number(y) + 4}
    width={width}
    height={height}
    rx={rounded}
    ry={rounded}
    {...rest}
  />
);

Caption.defaultProps = CaptionDefaultProps;

export { Avatar, Body1, Body2, Caption, Heading, PageHeading, DisplayXLarge };
