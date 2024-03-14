import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgJudgeGavel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M14.543 4.043a2.768 2.768 0 1 1 3.914 3.914L17.164 9.25l4.043 4.043a1 1 0 0 1-1.414 1.414l-4.043-4.043-1.293 1.293a2.768 2.768 0 0 1-3.914-3.914l4-4Zm2.5 1.414c-.3-.3-.786-.3-1.086 0l-4 4a.768.768 0 0 0 1.086 1.086l4-4c.3-.3.3-.786 0-1.086Z"
      clipRule="evenodd"
    />
    <Path
      fill="#000"
      d="M4.707 7.293a1 1 0 0 0-1.414 1.414l1.5 1.5a1 1 0 0 0 1.414-1.414l-1.5-1.5ZM2 12a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H2Z"
    />
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M6.442 16a3 3 0 0 0-2.847 2.051L3.28 19H3a1 1 0 1 0 0 2h13a1 1 0 1 0 0-2h-.28l-.316-.949A3 3 0 0 0 12.56 16H6.442Zm7.17 3H5.388l.106-.316A1 1 0 0 1 6.442 18h6.117a1 1 0 0 1 .948.684l.106.316Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgJudgeGavel;
