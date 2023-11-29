import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSignature = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 18s-1.334 1.544-2.834 1.544-2.707-1.429-4.18-1.429c-1.472 0-2.395.804-2.986 1.43m7.414-15.13.172.17a2 2 0 0 1 0 2.83l-12 12A2 2 0 0 1 5.172 20H3v-2.172a2 2 0 0 1 .586-1.414l12-12a2 2 0 0 1 2.828 0Z"
    />
  </Svg>
);
export default SvgSignature;
