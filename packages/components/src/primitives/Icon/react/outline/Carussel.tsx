import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCarussel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 6v12m0-12a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2m10 0h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2m0 0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2m0 0V6m0 12H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"
    />
  </Svg>
);
export default SvgCarussel;
