import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m10 19 2 2 2-2m-4-8h4M4 3h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M5.125 7a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm12 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm-4 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm12 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgKeyboardDown;
