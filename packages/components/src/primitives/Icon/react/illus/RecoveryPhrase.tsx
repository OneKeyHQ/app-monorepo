import Svg, { Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRecoveryPhrase = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#fff"
      stroke="#000"
      d="m149.134 37.5-12.566 21.75-.067.116v59.001L125.211 138H35.364l11.07-19.251.067-.115v-59L59.288 37.5z"
    />
    <Rect
      width={5}
      height={5}
      x={-0.305}
      y={-0.46}
      stroke="#000"
      strokeMiterlimit={16}
      rx={2.5}
      transform="matrix(1 0 -.39073 .9205 68.086 51.407)"
    />
    <Path stroke="#000" strokeMiterlimit={16} d="M71.046 49.603 73 45h-2" />
    <Path
      fill="#000"
      d="M84 68H57v-1h27zm39 0H96v-1h27zM84 80H57v-1h27zm39 0H96v-1h27zM84 92H57v-1h27zm39 0H96v-1h27zM84 104H57v-1h27zm39 0H96v-1h27zM84 116H57v-1h27zm39 0H96v-1h27zM79 128H52v-1h27zm39 0H91v-1h27z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="M137.268 108.092c1.225-2.122 4.288-2.122 5.513 0l19.336 33.49c1.225 2.122-.306 4.774-2.757 4.774h-38.672c-2.45 0-3.981-2.652-2.756-4.774z"
    />
    <Path
      fill="#000"
      stroke="#000"
      d="M134.268 110.092c1.225-2.122 4.288-2.122 5.513 0l19.336 33.49c1.225 2.122-.306 4.774-2.757 4.774h-38.672c-2.45 0-3.981-2.652-2.756-4.774z"
    />
    <Path stroke="#fff" strokeWidth={3} d="M137 135v-13M139 139h-4" />
  </Svg>
);
export default SvgRecoveryPhrase;
