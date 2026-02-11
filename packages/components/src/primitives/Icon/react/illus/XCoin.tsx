import Svg, { Path, Mask, Circle, G, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXCoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      d="M93.5 39c27.338 0 49.5 22.162 49.5 49.5 0 20.588-12.57 38.238-30.453 45.7A49.26 49.26 0 0 1 87.5 141C60.162 141 38 118.838 38 91.5c0-20.588 12.57-38.239 30.452-45.7A49.27 49.27 0 0 1 93.5 39"
      style={{
        fill: '#000',
        fillOpacity: 1,
      }}
    />
    <Mask
      id="mask0_993_37919"
      width={97}
      height={98}
      x={44}
      y={40}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: 'alpha',
      }}
    >
      <Circle
        cx={92.5}
        cy={88.501}
        r={48}
        fill="#000"
        stroke="#000"
        style={{
          fill: '#000',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
      />
    </Mask>
    <G fill="#4FE737" stroke="#000" mask="url(#mask0_993_37919)">
      <Path
        d="M-.289.645h37.9v10.13h-37.9z"
        style={{
          fill: '#4fe737',
          fill: 'color(display-p3 .3094 .9059 .2161)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
        transform="scale(1 -1)rotate(20.877 322.781 261.506)"
      />
      <Path
        d="M-.289.645h27.086V19.56H-.289z"
        style={{
          fill: '#4fe737',
          fill: 'color(display-p3 .3094 .9059 .2161)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
        transform="scale(1 -1)rotate(20.877 277.788 294.503)"
      />
    </G>
    <Circle
      cx={87.5}
      cy={91.5}
      r={49}
      fill="#fff"
      stroke="#000"
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Circle
      cx={87.5}
      cy={91.5}
      r={37}
      fill="#fff"
      stroke="#000"
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#000"
      d="M74 107h24.5a7.5 7.5 0 1 0 0-15H74M99 77H74.5a7.5 7.5 0 0 0 0 15H99"
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#000"
      strokeLinejoin="bevel"
      d="M86.547 71v5.648M86.54 106.618v5.648"
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
export default SvgXCoin;
