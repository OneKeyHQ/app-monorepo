import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSunrise = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m-8 8H3m17 0h1m-3.344-5.657.707-.707M3 16h18M7 20h10M6.344 6.343l-.707-.707M8 12a4 4 0 1 1 8 0"
    />
  </Svg>
);
export default SvgSunrise;
