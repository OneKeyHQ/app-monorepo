import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrush = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m16.5 15.5-8-8m6 10 5.586-5.586a2 2 0 0 0 0-2.828L19.5 8.5h-2v-2l-2.586-2.586a2 2 0 0 0-2.828 0L6.5 9.5a1.413 1.413 0 0 0 0 2 2.12 2.12 0 0 1 .001 2.999l-2.586 2.587a2 2 0 0 0 0 2.828l.172.172a2 2 0 0 0 2.828 0L9.5 17.498a2.12 2.12 0 0 1 3 0 1.413 1.413 0 0 0 1.999.001Z"
    />
  </Svg>
);
export default SvgBrush;
