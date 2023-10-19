import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderDelete = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M3 11V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.664.89l1.11 1.665a1 1 0 0 0 .831.445H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8m-4-4-2 2m0 0-2 2m2-2-2-2m2 2 2 2"
    />
  </Svg>
);
export default SvgFolderDelete;
