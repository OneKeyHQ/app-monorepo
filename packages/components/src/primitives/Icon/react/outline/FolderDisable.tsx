import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderDisable = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 9V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.664.89l1.11 1.665a1 1 0 0 0 .831.445H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6m-4.172-.172a4 4 0 0 0-5.656-5.656m5.656 5.656a4 4 0 0 1-5.656-5.656m5.656 5.656-5.656-5.656"
    />
  </Svg>
);
export default SvgFolderDisable;
