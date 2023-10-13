import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEuro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2ZM8.092 13c.408 2.203 2.137 4 4.408 4 1.307 0 2.458-.616 3.26-1.55a1 1 0 1 0-1.52-1.301c-.469.547-1.088.851-1.74.851-1.007 0-2.002-.776-2.36-2H11a1 1 0 1 0 0-2h-.86c.358-1.224 1.353-2 2.36-2 .652 0 1.271.304 1.74.851a1 1 0 1 0 1.52-1.301C14.957 7.616 13.806 7 12.5 7c-2.27 0-4 1.797-4.408 4H8a1 1 0 1 0 0 2h.092Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEuro;
