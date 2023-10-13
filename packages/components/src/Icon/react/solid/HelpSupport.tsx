import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHelpSupport = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 11.5a2.5 2.5 0 0 1 2.033-2.457C4.415 5.04 8.008 2 12.25 2c4.242 0 7.835 3.04 8.216 7.043A2.5 2.5 0 0 1 22.5 11.5V15a2.501 2.501 0 0 1-1.825 2.408A5.502 5.502 0 0 1 15.25 22H13.5a2.5 2.5 0 0 1-2.5-2.5V19a1 1 0 1 1 2 0v.5a.5.5 0 0 0 .5.5h1.75a3.502 3.502 0 0 0 3.355-2.5H18.5a1 1 0 0 1-1-1V10a1 1 0 0 1 .947-.999C18.05 6.228 15.484 4 12.25 4s-5.8 2.228-6.197 5.001A1 1 0 0 1 7 10v6.5a1 1 0 0 1-1 1H4.5A2.5 2.5 0 0 1 2 15v-3.5Z"
    />
  </Svg>
);
export default SvgHelpSupport;
