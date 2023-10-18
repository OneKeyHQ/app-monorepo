import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloudy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M9 4a8 8 0 1 0 0 16h8a6 6 0 1 0-.802-11.947c-.146.02-.27-.055-.315-.132A7.997 7.997 0 0 0 9 4Z"
    />
  </Svg>
);
export default SvgCloudy;
