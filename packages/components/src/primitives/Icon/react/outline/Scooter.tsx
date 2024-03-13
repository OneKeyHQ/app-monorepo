import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgScooter = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#000"
      fillRule="evenodd"
      d="M13 5a1 1 0 0 1 1-1h.86a3 3 0 0 1 2.942 2.412l1.33 6.645a3.501 3.501 0 1 1-3.987 4.443h-6.29A3.502 3.502 0 0 1 2 16.5a3.5 3.5 0 0 1 6.855-1h6.29a3.51 3.51 0 0 1 1.99-2.224l-1.294-6.472a1 1 0 0 0-.98-.804H14a1 1 0 0 1-1-1ZM4 16.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm13 0a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgScooter;
