import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgIceberg = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      fill="#5b5b5b"
      fillRule="evenodd"
      d="M3 22a.5.5 0 0 1 .5-.5H4a.5.5 0 0 1 0 1h-.5A.5.5 0 0 1 3 22m2.5 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1H9a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 0 1H33a.5.5 0 0 1-.5-.5"
      clipRule="evenodd"
    />
    <Path fill="#000" d="M11 22a8 8 0 0 1 8-8h5v2h-5a6 6 0 0 0-6 6z" />
    <Path fill="#000" d="m17 20 5-5 5 5h-3v4h-4v-4z" />
  </Svg>
);
export default SvgIceberg;
