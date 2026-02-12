import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGlobeErrorDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Circle cx={93} cy={88} r={55} fill="#fff" />
    <Circle
      cx={90}
      cy={90}
      r={55}
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
    />
    <Ellipse
      cx={90}
      cy={90}
      stroke="#fff"
      strokeLinejoin="round"
      rx={32}
      ry={55}
    />
    <Path stroke="#fff" d="M90 35v110M35 90h110M44 60h92M44 120h92" />
    <Rect
      width={44}
      height={45}
      x={109}
      y={102}
      fill="#000"
      stroke="#000"
      rx={22}
    />
    <Rect width={45} height={46} x={106} y={104} fill="#C6D5E0" rx={22.5} />
    <Rect width={45} height={46} x={106} y={104} fill="#fff" rx={22.5} />
    <Rect
      width={45}
      height={46}
      x={106}
      y={104}
      stroke="#000"
      strokeWidth={2}
      rx={22.5}
    />
    <Path stroke="#000" strokeWidth={6} d="m118 138 21-21M139 138l-21-21" />
  </Svg>
);
export default SvgGlobeErrorDark;
