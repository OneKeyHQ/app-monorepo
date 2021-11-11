/* eslint-disable  */
import React, { Component } from 'react';
import {
  NativeModules,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  NativeEventEmitter,
  EmitterSubscription,
} from 'react-native';

const { OKLiteManager } = NativeModules;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    width: 150,
    backgroundColor: '#DDDDDD',
    padding: 10,
    marginBottom: 20,
  },
});

export default class LiteDemo extends Component {
  eventListener: EmitterSubscription | null = null;

  // eslint-disable-next-line react/sort-comp
  componentDidMount() {
    const eventEmitter = new NativeEventEmitter(OKLiteManager);

    this.eventListener = eventEmitter.addListener('nfc_ui_event', (event) => {
      console.log('nfc_ui_event', event);
    });
    this.eventListener = eventEmitter.addListener(
      'nfc_active_connection',
      (event) => {
        console.log(
          'nfc_active_connection',
          'A new NFC device is actively connected. ',
          event,
        );
      },
    );
  }

  componentWillUnmount() {
    if (this.eventListener !== null) this.eventListener.remove();
  }

  // eslint-disable-next-line class-methods-use-this
  getLiteInfo() {
    OKLiteManager.getLiteInfo('OKLFT21041203947', (error: any, data: any) => {
      console.log('error = ', error, 'data = ', data);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  backup() {
    OKLiteManager.setMnemonic(
      'space raise engine dumb aware purse arrive three polar slam sell bottom',
      '111111',
      (error: any, data: any) => {
        console.log('error = ', error, 'data = ', data);
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this
  restore() {
    OKLiteManager.getMnemonicWithPin('111111', (error: any, data: any) => {
      console.log('error = ', error, 'data = ', data);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  reset() {
    OKLiteManager.reset((error: any, data: any) => {
      console.log('error = ', error, 'data = ', data);
    });
  }

  render() {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={this.getLiteInfo}>
          <Text>获取设备信息</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={this.backup}>
          <Text>导入助记词</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={this.restore}>
          <Text>获取助记词</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text>重置</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
