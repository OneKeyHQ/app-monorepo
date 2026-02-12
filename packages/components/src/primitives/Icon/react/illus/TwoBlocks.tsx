import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTwoBlocks = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#000"
      strokeLinejoin="round"
      d="M114.001 53H172l-16 16H98zM114 111h58l-16 16H98z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M114 53h58v58h-58z" />
    <Path stroke="#000" strokeLinejoin="round" d="M98 69h58v58H98z" />
    <Path fill="#000" d="M155.997 126.838V111h15.839z" />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M113.839 53v15.838H98z"
    />
    <Path
      stroke="#000"
      strokeLinejoin="round"
      d="M24.001 53H82L66 69H8zM24 111h58l-16 16H8z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M24 53h58v58H24z" />
    <Path stroke="#000" strokeLinejoin="round" d="M8 69h58v58H8z" />
    <Path fill="#000" d="M23.839 53v15.838H8z" />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M65.997 126.838V111h15.839z"
    />
    <Path
      stroke="#000"
      strokeDasharray="2 2"
      strokeLinejoin="round"
      d="M136 59V37H96.5M45 59V37h37.5M90 32.5V21M102.944 24.913l-8.132 8.131M85.132 33.044 77 24.913M89.938 40.544v11.5M76.993 48.132 85.125 40M94.806 40l8.132 8.132M136 127v15H96.5M45 127v15h37.5M90 146.5V158M102.944 154.087l-8.132-8.131M85.132 145.956 77 154.087M89.938 138.456v-11.5M76.993 130.868 85.125 139M94.806 139l8.132-8.132"
    />
  </Svg>
);
export default SvgTwoBlocks;
