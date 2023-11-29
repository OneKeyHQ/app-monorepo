import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRotateCounterclockwise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M19.027 12a7 7 0 0 0-7-7c-1.974 0-3.402.68-4.786 2H9a1 1 0 0 1 0 2H5.75A1.75 1.75 0 0 1 4 7.25V4a1 1 0 0 1 2 0v1.423C7.622 3.922 9.476 3 12.027 3A9 9 0 1 1 3.54 15a1 1 0 0 1 1.885-.667A7 7 0 0 0 19.027 12Z"
    />
  </Svg>
);
export default SvgRotateCounterclockwise;
