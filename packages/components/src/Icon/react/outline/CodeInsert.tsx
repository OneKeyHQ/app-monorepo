import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7m4-14h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3m0-14V2.5M16 5v14m0 0v2.5m-8-12 2.5 2.5L8 14.5"
    />
  </Svg>
);
export default SvgCodeInsert;
