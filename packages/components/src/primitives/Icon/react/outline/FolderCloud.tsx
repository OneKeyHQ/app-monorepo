import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderCloud = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.664.89l1.11 1.665a1 1 0 0 0 .831.445H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2 16.75A3.25 3.25 0 0 0 5.25 20H8a2.5 2.5 0 0 0 0-5h-.011A3.25 3.25 0 0 0 2 16.75Z"
    />
  </Svg>
);
export default SvgFolderCloud;
