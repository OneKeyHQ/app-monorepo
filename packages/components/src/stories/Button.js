import { Text, TouchableOpacity } from 'react-native';

export const Button = ({ onPress, text }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      borderColor: 'lightgrey',
      borderWidth: 1,
      borderRadius: 2,
      paddingVertical: 8,
      paddingHorizontal: 32,
      alignSelf: 'flex-start',
    }}
  >
    <Text>{text}</Text>
  </TouchableOpacity>
);
