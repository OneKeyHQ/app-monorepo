import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStocks = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 12a2 2 0 1 0 0-4m0 4a1.994 1.994 0 0 1-1.414-.586M14 12v8m0-12a2 2 0 0 0-1.414 3.414M14 8V4m0 0H6a2 2 0 0 0-2 2v10M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4m0 0H6a2 2 0 0 1-2-2v-2m8.586-4.586L9 15l-2-2-3 3"
    />
  </Svg>
);
export default SvgStocks;
