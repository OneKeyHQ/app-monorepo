import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWebcam = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      stroke="currentColor"
      d="M11.5 17.938v-.441l-.438-.055A7.501 7.501 0 0 1 12 2.5a7.5 7.5 0 0 1 .938 14.942l-.438.055V20.5H17a.5.5 0 0 1 0 1H7a.5.5 0 0 1 0-1h4.5v-2.562ZM10.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM12 5.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"
    />
  </Svg>
);
export default SvgWebcam;
