import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocument = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      stroke="#000"
      strokeLinejoin="round"
      d="M48.5 32.5h87v112h-87z"
      style={{
        fill: '#000',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M46.5 34.5h87v112h-87z"
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#000"
      d="M120 44v12l4-3.5M115 57V45l-4 3.5M56 46h20M56 55h37M56 136h19"
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
  </Svg>
);
export default SvgDocument;
