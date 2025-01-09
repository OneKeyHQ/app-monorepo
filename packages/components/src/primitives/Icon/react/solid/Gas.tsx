import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGas = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3h1a3 3 0 0 1 3 3v3.5a.5.5 0 0 0 1 0V8.828a1 1 0 0 0-.293-.707l-1.414-1.414a1 1 0 0 1 1.414-1.414l1.414 1.414A3 3 0 0 1 22 8.828V15.5a2.5 2.5 0 0 1-5 0V12a1 1 0 0 0-1-1h-1v8a1 1 0 1 1 0 2H3a1 1 0 1 1 0-2V6Zm3 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGas;
