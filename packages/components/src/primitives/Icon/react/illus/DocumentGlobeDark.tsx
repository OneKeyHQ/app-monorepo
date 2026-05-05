import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGlobeDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#fff"
      stroke="#fff"
      strokeLinejoin="round"
      d="M48.5 32.5h87v112h-87z"
    />
    <Path
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
      d="M46.5 34.5h87v112h-87z"
    />
    <Path stroke="#fff" d="M56 46h20M56 55h37M56 136h19" />
    <Circle cx={113} cy={122} r={14} stroke="#fff" strokeLinejoin="round" />
    <Ellipse
      cx={113}
      cy={122}
      stroke="#fff"
      strokeLinejoin="round"
      rx={8}
      ry={14}
    />
    <Path stroke="#fff" d="M113 108v28M99 122h28M102 113h22M102 131h22" />
  </Svg>
);
export default SvgDocumentGlobeDark;
