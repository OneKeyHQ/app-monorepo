import Svg, { Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRecoveryPhraseDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      stroke="#fff"
      d="m149.134 37.5-12.566 21.75-.067.116v59.001L125.211 138H35.364l11.07-19.251.067-.115v-59L59.288 37.5z"
    />
    <Rect
      width={5}
      height={5}
      x={-0.305}
      y={-0.46}
      stroke="#fff"
      strokeMiterlimit={16}
      rx={2.5}
      transform="matrix(1 0 -.39073 .9205 68.086 51.407)"
    />
    <Path stroke="#fff" strokeMiterlimit={16} d="M71.046 49.603 73 45h-2" />
    <Path
      fill="#fff"
      d="M84 68H57v-1h27zm39 0H96v-1h27zM84 80H57v-1h27zm39 0H96v-1h27zM84 92H57v-1h27zm39 0H96v-1h27zM84 104H57v-1h27zm39 0H96v-1h27zM84 116H57v-1h27zm39 0H96v-1h27zM79 128H52v-1h27zm39 0H91v-1h27z"
    />
    <Path
      fill="#000"
      d="M137.835 106.841c1.418-2.455 4.961-2.455 6.379 0l19.336 33.491c1.417 2.456-.354 5.525-3.19 5.525h-38.672c-2.835 0-4.607-3.069-3.189-5.525z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeWidth={2}
      d="M134.701 110.342c1.033-1.789 3.614-1.789 4.647 0l19.336 33.49c1.032 1.789-.258 4.024-2.324 4.024h-38.672c-2.065 0-3.355-2.235-2.323-4.024z"
    />
    <Path stroke="#000" strokeWidth={3} d="M137 135v-13M139 139h-4" />
  </Svg>
);
export default SvgRecoveryPhraseDark;
