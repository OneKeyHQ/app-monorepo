import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 4a7 7 0 0 0-6.402 4.165A6.002 6.002 0 0 0 7 20h11a5 5 0 0 0 .941-9.912A7.001 7.001 0 0 0 12 4Z"
    />
  </Svg>
);
export default SvgCloud;
