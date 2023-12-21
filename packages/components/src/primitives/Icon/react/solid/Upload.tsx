import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUpload = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 11.75a1 1 0 0 1 1 1V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5.25a1 1 0 1 1 2 0V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5.25a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 3a1 1 0 0 1 .707.293l4.5 4.5a1 1 0 0 1-1.414 1.414L13 6.414v8.836a1 1 0 1 1-2 0V6.414L8.207 9.207a1 1 0 0 1-1.414-1.414l4.5-4.5A1 1 0 0 1 12 3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUpload;
