import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPassKey = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM9.5 6.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z"
      fill="currentColor"
    />
    <Path
      d="M5.92 18.21C6.837 15.732 9.05 14 12 14a1 1 0 1 0 0-2c-3.832 0-6.765 2.296-7.955 5.516-.34.92-.108 1.828.433 2.473A2.898 2.898 0 0 0 6.697 21H14a1 1 0 1 0 0-2H6.697a.9.9 0 0 1-.687-.297.465.465 0 0 1-.09-.493Z"
      fill="currentColor"
    />
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15 14a3 3 0 1 1 4.25 2.728V18l-.75.75.75.677v.833a.5.5 0 0 1-.188.39l-.75.6a.5.5 0 0 1-.624 0l-.75-.6a.5.5 0 0 1-.188-.39v-3.532A3 3 0 0 1 15 14Zm3-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      fill="currentColor"
    />
  </Svg>
);
export default SvgPassKey;
