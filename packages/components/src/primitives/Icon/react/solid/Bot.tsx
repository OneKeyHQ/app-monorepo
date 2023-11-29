import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBot = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 1a1 1 0 0 1 1 1v1h4a3 3 0 0 1 3 3v5a2.99 2.99 0 0 1-1 2.236v1.35l1.707 1.707a1 1 0 0 1-1.414 1.414l-.612-.612a7.003 7.003 0 0 1-13.362 0l-.612.612a1 1 0 0 1-1.414-1.414L5 14.586v-1.35c-.614-.55-1-1.348-1-2.236V6a3 3 0 0 1 3-3h4V2a1 1 0 0 1 1-1ZM7 5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7Zm2 2a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V8a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBot;
