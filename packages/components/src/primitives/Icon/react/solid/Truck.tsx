import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTruck = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10.965 17a3.5 3.5 0 0 1-6.941-.089A2.715 2.715 0 0 1 2 14.286v-3.68a3 3 0 0 1 .504-1.665l1.07-1.605A3 3 0 0 1 6.07 6h2.1A3.001 3.001 0 0 1 11 4h8a3 3 0 0 1 3 3v8a2 2 0 0 1-2.035 2 3.5 3.5 0 0 1-6.93 0h-2.07ZM8 8H6.07a1 1 0 0 0-.832.445l-1.07 1.606a1 1 0 0 0-.168.555v3.68c0 .273.153.51.378.63A3.5 3.5 0 0 1 8 13.036V8Zm8.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6 16.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTruck;
