import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPassword = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm.002 10c-3.832 0-6.765 2.296-7.956 5.516-.34.92-.107 1.828.434 2.473A2.898 2.898 0 0 0 6.698 21h8.052v-3.2A4.988 4.988 0 0 1 13 14c0-.672.133-1.313.373-1.898A9.169 9.169 0 0 0 12.002 12Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18 11a3 3 0 0 0-1.25 5.728v3.532a.5.5 0 0 0 .188.39l.75.6a.5.5 0 0 0 .624 0l.75-.6a.5.5 0 0 0 .188-.39v-.833l-.75-.677.75-.75v-1.272A3 3 0 0 0 18 11Zm-1 3a1 1 0 1 1 2 0 1 1 0 0 1-2 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassword;
