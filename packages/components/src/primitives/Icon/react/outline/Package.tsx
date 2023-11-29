import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPackage = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M9 4v3.5A1.5 1.5 0 0 0 10.5 9h3A1.5 1.5 0 0 0 15 7.5V4m-1 12h2M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z"
    />
  </Svg>
);
export default SvgPackage;
