import Svg, { Path, Mask, Circle, G, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgXCoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      d="M93.5 39c27.338 0 49.5 22.162 49.5 49.5 0 20.588-12.57 38.238-30.453 45.7A49.26 49.26 0 0 1 87.5 141C60.162 141 38 118.838 38 91.5c0-20.588 12.57-38.239 30.452-45.7A49.27 49.27 0 0 1 93.5 39"
    />
    <Mask
      id="mask0_993_37919"
      width={97}
      height={98}
      x={44}
      y={40}
      maskUnits="userSpaceOnUse"
    >
      <Circle cx={92.5} cy={88.501} r={48} fill="#000" stroke="#000" />
    </Mask>
    <G fill="#4FE737" stroke="#000" mask="url(#mask0_993_37919)">
      <Path d="m113.883 97.36 35.412-13.507-3.61-9.465-35.412 13.506zM122.688 79.16l25.308-9.653-6.74-17.674-25.309 9.653z" />
    </G>
    <Circle cx={87.5} cy={91.5} r={49} fill="#fff" stroke="#000" />
    <Circle cx={87.5} cy={91.5} r={37} fill="#fff" stroke="#000" />
    <Path
      stroke="#000"
      d="M74 107h24.5a7.5 7.5 0 1 0 0-15H74M99 77H74.5a7.5 7.5 0 0 0 0 15H99"
    />
    <Path
      stroke="#000"
      strokeLinejoin="bevel"
      d="M86.547 71v5.648M86.54 106.618v5.648"
    />
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
export default SvgXCoin;
