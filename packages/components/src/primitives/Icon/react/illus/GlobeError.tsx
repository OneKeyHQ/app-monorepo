import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGlobeError = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Circle cx={93} cy={88} r={55} fill="#000" />
    <Circle
      cx={90}
      cy={90}
      r={55}
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
    />
    <Ellipse
      cx={90}
      cy={90}
      stroke="#000"
      strokeLinejoin="round"
      rx={32}
      ry={55}
    />
    <Path stroke="#000" d="M90 35v110M35 90h110M44 60h92M44 120h92" />
    <Rect
      width={43}
      height={44}
      x={109.5}
      y={102.5}
      fill="#fff"
      stroke="#000"
      rx={21.5}
    />
    <Rect width={44} height={45} x={106.5} y={104.5} fill="#C6D5E0" rx={22} />
    <Rect width={44} height={45} x={106.5} y={104.5} fill="#000" rx={22} />
    <Rect width={44} height={45} x={106.5} y={104.5} stroke="#000" rx={22} />
    <Path stroke="#fff" strokeWidth={6} d="m118 138 21-21M139 138l-21-21" />
  </Svg>
);
export default SvgGlobeError;
