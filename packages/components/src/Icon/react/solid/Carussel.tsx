import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCarussel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.17 5A3.001 3.001 0 0 1 9 3h6c1.306 0 2.418.835 2.83 2H19a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-1.17A3.001 3.001 0 0 1 15 21H9a3.001 3.001 0 0 1-2.83-2H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h1.17ZM6 7H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h1V7Zm12 10h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1v10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCarussel;
