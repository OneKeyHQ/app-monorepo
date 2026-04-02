import Svg, { Path, Circle } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockPercentageDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#D9D9D9" d="M57 33h90v90H57z" />
    <Path fill="#000" d="M57 33h90v90H57z" />
    <Path stroke="#fff" strokeLinejoin="round" d="M57 33h90v90H57z" />
    <Path
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
      d="M33 57h90v90H33zM123 57v90l24-24V33z"
    />
    <Path stroke="#fff" strokeLinejoin="round" d="M57 33h90l-24 24H33z" />
    <Circle cx={101.5} cy={108.501} r={3.5} stroke="#fff" />
    <Circle cx={89.5} cy={96.501} r={3.5} stroke="#fff" />
    <Path stroke="#fff" d="m104 94.001-17 17M69 104h12M51 104h12" />
    <Path fill="#4FE737" stroke="#000" d="M57 31.5V58H31.5z" />
  </Svg>
);
export default SvgBlockPercentageDark;
