import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgContrast = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 20a8 8 0 1 0 0-16v16Zm10-8c0 5.523-4.477 10-10 10-.375 0-.745-.02-1.11-.061C5.89 21.386 2 17.148 2 12s3.89-9.386 8.89-9.939A10.1 10.1 0 0 1 12 2c5.523 0 10 4.477 10 10Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgContrast;
