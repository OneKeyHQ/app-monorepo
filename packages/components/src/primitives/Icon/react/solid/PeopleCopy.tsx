import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleCopy = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h1v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1V5a3 3 0 0 0-3-3H5Zm11 4V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1V9a3 3 0 0 1 3-3h7Zm-2 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM9.752 20c-.358 0-.597-.366-.433-.683 2.291-4.423 7.07-4.423 9.362 0 .165.317-.075.683-.433.683H9.752Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPeopleCopy;
