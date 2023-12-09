import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRotateClockwise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M4.973 12a7 7 0 0 1 7-7c1.974 0 3.402.68 4.786 2H15a1 1 0 1 0 0 2h3.25A1.75 1.75 0 0 0 20 7.25V4a1 1 0 1 0-2 0v1.423C16.378 3.922 14.524 3 11.973 3a9 9 0 1 0 8.487 12 1 1 0 0 0-1.885-.667A7 7 0 0 1 4.973 12Z"
    />
  </Svg>
);
export default SvgRotateClockwise;
