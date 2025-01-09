import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M3 10V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.664.89l1.11 1.665a1 1 0 0 0 .831.445H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-4m-7-5a3 3 0 1 1 0 6m-3-6a3 3 0 1 0 0 6m2-3H6"
    />
  </Svg>
);
export default SvgFolderLink;
