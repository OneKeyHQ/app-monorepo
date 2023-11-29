import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.44 19h13.59a2 2 0 0 0 1.909-1.404l1.655-5.298A1 1 0 0 0 20.64 11H20M4.44 19c.63 0 1.188-.41 1.376-1.011l1.745-5.586A2 2 0 0 1 9.471 11H20M4.44 19A1.44 1.44 0 0 1 3 17.56V6a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.664.89l1.11 1.665a1 1 0 0 0 .831.445H18a2 2 0 0 1 2 2v2"
    />
  </Svg>
);
export default SvgFolderOpen;
