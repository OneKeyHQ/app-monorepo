import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';

import { Button, Stack, Text } from '@onekeyhq/components';

const NativeStack = createNativeStackNavigator();

function HomeScreen({ navigation }: { navigation: any }) {
  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Text>Home Screen</Text>
      <Button
        onPress={() => {
          console.log('navigation', navigation);
          navigation.navigate('TransparentModal');
        }}
      >
        <Button.Text>Open Modal</Button.Text>
      </Button>
    </Stack>
  );
}

function ModalScreen() {
  return (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Text>Modal Screen</Text>
    </Stack>
  );
}

function TransparentModalScreen({ navigation }) {
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={() => navigation.goBack()}
    >
      <TouchableOpacity
        style={styles.modalBackground}
        activeOpacity={1}
        onPressOut={() => navigation.goBack()}
      >
        <Stack style={styles.modalContent}>
          <Text>Transparent Modal Screen</Text>
        </Stack>
      </TouchableOpacity>
    </Modal>
  );
}

export default function App() {
  return (
    // <NavigationContainer>
    <NativeStack.Navigator
      screenOptions={{
        headerShown: false,
        presentation: 'transparentModal',
      }}
    >
      <NativeStack.Screen name="Home" component={HomeScreen} />
      <NativeStack.Screen name="Modal" component={ModalScreen} />
      <NativeStack.Screen
        name="TransparentModal"
        component={TransparentModalScreen}
      />
    </NativeStack.Navigator>
    // </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
});
