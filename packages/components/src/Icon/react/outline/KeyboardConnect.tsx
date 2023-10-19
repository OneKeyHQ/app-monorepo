import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M5.125 13a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm12 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm12 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 17h4M6 9V7a2 2 0 0 1 2-2h8.5A1.5 1.5 0 0 0 18 3.5V3M4 9h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
    />
  </Svg>
);
export default SvgKeyboardConnect;
