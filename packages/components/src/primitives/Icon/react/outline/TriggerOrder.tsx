import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTriggerOrder = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 36 36" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillOpacity={0.4}
      fillRule="evenodd"
      d="M3 21.5a.5.5 0 0 1 .5-.5H4a.5.5 0 0 1 0 1h-.5a.5.5 0 0 1-.5-.5m2.5 0A.5.5 0 0 1 6 21h1a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5m3 0A.5.5 0 0 1 9 21h1a.5.5 0 0 1 0 1H9a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5m3 0a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 0 1H33a.5.5 0 0 1-.5-.5"
      clipRule="evenodd"
    />
    <Path
      fill="#00000000"
      stroke="currentColor"
      strokeLinecap="round"
      strokeOpacity={0.4}
      d="M3 11.5h17.5M31.5 11.5H34"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.5 28 4.5-6.5 5 3.5 6.2-9.8"
    />
    <Path
      stroke="currentColor"
      strokeWidth={2}
      d="M23 11a3 3 0 1 1 6 0 3 3 0 1 1-6 0"
    />
  </Svg>
);
export default SvgTriggerOrder;
