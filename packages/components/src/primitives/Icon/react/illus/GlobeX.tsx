import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGlobeX = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Circle
      cx={93}
      cy={88}
      r={55}
      fill="#000"
      style={{
        fill: '#000',
        fillOpacity: 1,
      }}
    />
    <Circle
      cx={90}
      cy={90}
      r={55}
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Ellipse
      cx={90}
      cy={90}
      stroke="#000"
      strokeLinejoin="round"
      rx={32}
      ry={55}
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#000"
      d="M90 35v110M35 90h110M44 60h92M44 120h92"
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Rect
      width={43}
      height={44}
      x={109.5}
      y={102.5}
      fill="#fff"
      stroke="#000"
      rx={21.5}
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Rect
      width={44}
      height={45}
      x={106.5}
      y={104.5}
      fill="#C6D5E0"
      rx={22}
      style={{
        fill: '#c6d5e0',
        fill: 'color(display-p3 .7765 .8353 .8784)',
        fillOpacity: 1,
      }}
    />
    <Rect
      width={44}
      height={45}
      x={106.5}
      y={104.5}
      fill="#000"
      rx={22}
      style={{
        fill: '#000',
        fillOpacity: 1,
      }}
    />
    <Rect
      width={44}
      height={45}
      x={106.5}
      y={104.5}
      stroke="#000"
      rx={22}
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#fff"
      strokeWidth={6}
      d="m118 138 21-21M139 138l-21-21"
      style={{
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
  </Svg>
);
export default SvgGlobeX;
