import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeDoor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.53 1.93a3 3 0 0 1 2.94 0l6 3.375A3 3 0 0 1 21 7.92V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.92a3 3 0 0 1 1.53-2.615l6-3.375ZM8.5 12a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeDoor;
