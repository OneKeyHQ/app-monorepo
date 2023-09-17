import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 1a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V2a1 1 0 0 1 1-1Zm3.932 1.77a3 3 0 0 1 3.135 0c.306.188.585.467.907.79l.072.071 3.323 3.323.07.072c.324.322.603.6.79.907a3 3 0 0 1 0 3.135l-.852-.523.853.523c-.188.305-.467.584-.79.907l-.071.07-1.662 1.662a1 1 0 0 1-1.414-1.414l1.661-1.662c.436-.435.524-.533.57-.608a1 1 0 0 0 0-1.046c-.046-.075-.134-.173-.57-.608l-3.323-3.323.707-.708-.707.708c-.435-.436-.533-.524-.608-.57a1 1 0 0 0-1.046 0c-.075.046-.173.134-.608.57l-.707-.708.707.708-1.662 1.661a1 1 0 1 1-1.414-1.414l1.661-1.662.071-.07c.323-.324.602-.603.907-.79Zm-10.14.023a1 1 0 0 1 1.415 0l1 1a1 1 0 0 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414ZM1 9a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H2a1 1 0 0 1-1-1Zm5.707 1.293a1 1 0 0 1 0 1.414L5.046 13.37c-.436.435-.524.533-.57.608a1 1 0 0 0 0 1.046c.046.075.134.173.57.608l-.708.707.708-.707 3.323 3.323-.707.707.707-.707c.435.436.533.524.608.57a1 1 0 0 0 1.046 0c.075-.046.173-.134.608-.57l1.662-1.661a1 1 0 0 1 1.414 1.414l-1.661 1.662-.071.07c-.323.324-.602.603-.907.79l-.523-.852.523.853a3 3 0 0 1-3.135 0c-.306-.188-.585-.467-.907-.79l-.072-.071-3.323-3.323a31.64 31.64 0 0 0-.07-.072c-.324-.322-.603-.6-.79-.907a3 3 0 0 1 0-3.135c.187-.305.466-.584.79-.907l.07-.07 1.662-1.662a1 1 0 0 1 1.414 0ZM20 15a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Zm-1.207 3.793a1 1 0 0 1 1.414 0l1 1a1 1 0 0 1-1.414 1.414l-1-1a1 1 0 0 1 0-1.414ZM15 20a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrokenLink;
