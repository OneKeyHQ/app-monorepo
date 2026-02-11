import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGlobe = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      stroke="#000"
      strokeLinejoin="round"
      d="M48.5 32.5h87v112h-87z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M46.5 34.5h87v112h-87z"
    />
    <Path stroke="#000" d="M56 46h20M56 55h37M56 136h19" />
    <Circle cx={113} cy={122} r={14} stroke="#000" strokeLinejoin="round" />
    <Ellipse
      cx={113}
      cy={122}
      stroke="#000"
      strokeLinejoin="round"
      rx={8}
      ry={14}
    />
    <Path stroke="#000" d="M113 108v28M99 122h28M102 113h22M102 131h22" />
  </Svg>
);
export default SvgDocumentGlobe;
