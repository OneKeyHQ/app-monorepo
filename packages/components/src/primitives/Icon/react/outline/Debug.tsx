import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDebug = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M17.5 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM20 4.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 2.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2.5-3.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m8.875 7.676-.978-.208a2 2 0 0 0-2.372 1.54l-1.663 7.826a2 2 0 0 0 1.54 2.372l5.87 1.247a2 2 0 0 0 2.371-1.54l1.664-7.825a2 2 0 0 0-1.54-2.372l-.979-.208m-3.913-.832L9.5 4.742a1 1 0 0 1 1.186-.77l1.957.415a1 1 0 0 1 .77 1.186l-.624 2.935m-3.913-.832 3.913.832m-4.358 3.67 1.155 1.778m0 0 1.155 1.78m-1.155-1.78 1.78-1.155m-1.78 1.155-1.779 1.156"
    />
  </Svg>
);
export default SvgDebug;
