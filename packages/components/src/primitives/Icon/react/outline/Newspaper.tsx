import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNewspaper = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 12V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11.5A2.5 2.5 0 0 0 5.5 20h13M16 12v5.5a2.5 2.5 0 0 0 2.5 2.5M16 12h3a2 2 0 0 1 2 2v3.5a2.5 2.5 0 0 1-2.5 2.5M7 16h5M7 8h5v4H7V8Z"
    />
  </Svg>
);
export default SvgNewspaper;
