import Svg, { Path, Circle } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockPercentage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#D9D9D9" d="M57 33h90v90H57z" />
    <Path fill="#fff" d="M57 33h90v90H57z" />
    <Path stroke="#000" strokeLinejoin="round" d="M57 33h90v90H57z" />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M33 56.999h90v90H33zM123 57v90l24-24V33z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M57 33h90l-24 24H33z" />
    <Circle cx={101.5} cy={108.5} r={3.5} stroke="#000" />
    <Circle cx={89.5} cy={96.501} r={3.5} stroke="#000" />
    <Path stroke="#000" d="m104 94-17 17M69 104h12M51 104h12" />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M57 33v24H33z"
    />
  </Svg>
);
export default SvgBlockPercentage;
