import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEyeClosed = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 5C9.465 5 6.882 6.1 4.728 8.39a1 1 0 0 1-1.456-1.37C5.763 4.37 8.858 3 12 3c3.142 0 6.237 1.37 8.728 4.019a1 1 0 1 1-1.457 1.37C17.119 6.1 14.535 5 12 5Zm-8.685 7.21a1 1 0 0 1 1.413.043c2.154 2.29 4.737 3.39 7.272 3.39s5.118-1.1 7.271-3.39a1 1 0 0 1 1.457 1.37c-1.182 1.258-2.5 2.227-3.896 2.898l1.024 1.694a1 1 0 0 1-1.712 1.034l-1.214-2.01a10.97 10.97 0 0 1-1.93.357V20a1 1 0 1 1-2 0v-2.404a10.97 10.97 0 0 1-1.93-.356l-1.214 2.01a1 1 0 1 1-1.712-1.035l1.024-1.694c-1.395-.671-2.714-1.64-3.896-2.898a1 1 0 0 1 .043-1.413Z"
    />
  </Svg>
);
export default SvgEyeClosed;
