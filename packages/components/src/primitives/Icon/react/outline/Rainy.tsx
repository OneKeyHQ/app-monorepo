import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRainy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.5 18-1 2m-4-2-1 2m11-2-1 2m-6-6H16a4 4 0 1 0-.54-7.964c-.532.072-1.092-.153-1.39-.598A5.5 5.5 0 1 0 9.5 14Z"
    />
  </Svg>
);
export default SvgRainy;
