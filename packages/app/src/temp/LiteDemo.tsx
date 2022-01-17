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
  Platform,
} from 'react-native';
import OnekeyLite from '../hardware/OnekeyLite';

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
    if (Platform.OS !== 'android') return;

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
  getCardName() {
    OnekeyLite.getCardName((error: any, data: any, state: any) => {
      console.log('error = ', error, 'data = ', data, 'state = ', state);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  getLiteInfo() {
    OnekeyLite.getLiteInfo((error: any, data: any, state: any) => {
      console.log('error = ', error, 'data = ', data, 'state = ', state);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  backup() {
    OnekeyLite.setMnemonic(
      'space raise engine dumb aware purse arrive three polar slam sell bottom',
      '111111',
      (error: any, data: any, state: any) => {
        console.log('error = ', error, 'data = ', data, 'state = ', state);
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this
  restore() {
    OnekeyLite.getMnemonicWithPin(
      '111111',
      (error: any, data: any, state: any) => {
        console.log('error = ', error, 'data = ', data, 'state = ', state);
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this
  reset() {
    OnekeyLite.reset((error: any, data: any, state: any) => {
      console.log('error = ', error, 'data = ', data, 'state = ', state);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  cancel() {
    OnekeyLite.cancel();
  }

  setting() {
    OnekeyLite.intoSetting();
  }

  render() {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.button} onPress={this.getLiteInfo}>
          <Text>获取设备信息</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={this.getCardName}>
          <Text>获取设备名称</Text>
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

        <TouchableOpacity style={styles.button} onPress={this.cancel}>
          <Text>取消扫描(Android Only)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={this.setting}>
          <Text>NFC 设置(Android Only)</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
