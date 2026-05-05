import Svg, { Path, Circle } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoinsDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      stroke="#fff"
      d="M99.5 32.5c27.062 0 49 21.938 49 49 0 20.379-12.442 37.851-30.146 45.238l-.031.014-.029.018A48.8 48.8 0 0 1 93.5 133.5c-27.062 0-49-21.938-49-49 0-20.379 12.441-37.852 30.144-45.24l.032-.013.03-.017A48.77 48.77 0 0 1 99.5 32.5Z"
    />
    <Path
      fill="#4FE737"
      d="M145.679 70.213a48.5 48.5 0 0 1 1.28 9.284l-26.787 10.217-3.254-8.53zM135.31 49.923a48.5 48.5 0 0 1 9.038 15.728l-15.371 5.863-6.385-16.74z"
    />
    <Circle cx={95.5} cy={83.5} r={48.5} fill="#000" />
    <Circle cx={93.5} cy={84.5} r={49} fill="#000" stroke="#fff" />
    <Circle cx={93.5} cy={84.5} r={37} fill="#000" stroke="#fff" />
    <Path
      stroke="#fff"
      d="M85.895 96.569v-4.183a6.736 6.736 0 0 1 6.899-6.734c7.187.174 13.107-5.605 13.107-12.795v-1.322a3.71 3.71 0 0 0-3.707-3.707H91.571a10 10 0 0 0-7.071 2.929l-3.137 3.136M82.742 101.883h6.908"
    />
  </Svg>
);
export default SvgCoinsDark;
