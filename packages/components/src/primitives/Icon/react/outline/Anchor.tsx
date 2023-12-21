import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAnchor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 0v13m6-9h3v.5a8.5 8.5 0 0 1-8.5 8.5H12m-6-9H3v.5a8.5 8.5 0 0 0 8.5 8.5h.5"
    />
  </Svg>
);
export default SvgAnchor;
