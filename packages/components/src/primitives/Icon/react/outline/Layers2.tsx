import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLayers2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.9 12-4.307 2.101a1 1 0 0 0 0 1.798l7.969 3.887a1 1 0 0 0 .877 0l7.969-3.887a1 1 0 0 0 0-1.798l-4.308-2.1m-8.2 0L3.593 9.898a1 1 0 0 1 0-1.798l7.969-3.887a1 1 0 0 1 .877 0L20.408 8.1a1 1 0 0 1 0 1.798L16.1 12m-8.2 0 3.662 1.786a1 1 0 0 0 .877 0L16.1 12"
    />
  </Svg>
);
export default SvgLayers2;
