import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSecretPhrase = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M6 9a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1ZM14 8a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM6 12a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1ZM14 11a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3ZM6 15a1 1 0 0 1 1-1h3a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1ZM14 14a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z"
      fill="currentColor"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H5Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgSecretPhrase;
