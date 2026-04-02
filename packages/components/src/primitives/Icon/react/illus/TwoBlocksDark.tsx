import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTwoBlocksDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#fff"
      strokeLinejoin="round"
      d="M114.001 53H172l-16 16H98zM114 111h58l-16 16H98z"
    />
    <Path stroke="#fff" strokeLinejoin="round" d="M114 53h58v58h-58z" />
    <Path stroke="#fff" strokeLinejoin="round" d="M98 69h58v58H98z" />
    <Path fill="#fff" d="M155.997 126.839V111h15.839z" opacity={0.8} />
    <Path fill="#4FE737" stroke="#000" d="M114 52.5V69H97.5z" />
    <Path
      stroke="#fff"
      strokeLinejoin="round"
      d="M24.001 53H82L66 69H8zM24 111h58l-16 16H8z"
    />
    <Path stroke="#fff" strokeLinejoin="round" d="M24 53h58v58H24z" />
    <Path stroke="#fff" strokeLinejoin="round" d="M8 69h58v58H8z" />
    <Path fill="#fff" d="M23.839 53v15.838H8z" opacity={0.8} />
    <Path fill="#4FE737" stroke="#000" d="m66 127.5.001-16.5H82.5z" />
    <Path
      stroke="#fff"
      strokeDasharray="2 2"
      strokeLinejoin="round"
      d="M136 59V37H96.5M45 59V37h37.5M90 32.5V21M102.944 24.913l-8.132 8.132M85.132 33.044 77 24.912M89.938 40.545v11.5M76.993 48.132 85.125 40M94.806 40l8.132 8.132M136 127v15H96.5M45 127v15h37.5M90 146.5V158M102.944 154.087l-8.132-8.132M85.132 145.956 77 154.088M89.938 138.455v-11.5M76.993 130.868 85.125 139M94.806 139l8.132-8.132"
    />
  </Svg>
);
export default SvgTwoBlocksDark;
