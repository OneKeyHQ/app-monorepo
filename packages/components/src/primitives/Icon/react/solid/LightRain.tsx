import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLightRain = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 9.5a6.5 6.5 0 0 1 11.9-3.62c.066.1.235.19.426.165A5 5 0 1 1 16 16h-4.632l-.974 1.947a1 1 0 1 1-1.788-.894l.531-1.063A6.5 6.5 0 0 1 3 9.5Zm10.947 8.106a1 1 0 0 1 .447 1.341l-1 2a1 1 0 1 1-1.788-.894l1-2a1 1 0 0 1 1.341-.447Z"
    />
  </Svg>
);
export default SvgLightRain;
