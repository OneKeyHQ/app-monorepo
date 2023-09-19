import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.288 4.819A1.5 1.5 0 0 0 1 6.095v7.81a1.5 1.5 0 0 0 2.288 1.277l6.323-3.905c.155-.096.285-.213.389-.344v2.973a1.5 1.5 0 0 0 2.288 1.276l6.323-3.905a1.5 1.5 0 0 0 0-2.553L12.288 4.82A1.5 1.5 0 0 0 10 6.095v2.973a1.506 1.506 0 0 0-.389-.344L3.288 4.82z" />
  </Svg>
);
export default SvgForward;
