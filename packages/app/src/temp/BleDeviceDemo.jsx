import { observer } from 'mobx-react';
import { Observer } from 'mobx-react-lite';
import { reaction } from 'mobx';
import React, { useContext, useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import useStores from '../hooks/use_store';
import { bleOnekeyConnect } from '../utils/BleOneKeyConnect';
import { toastLong } from '../utils/ToastUtil';

const BleDeviceDemo = () => {
  const { bleDeviceStore } = useStores();
  const [connectChange, setConnectChange] = useState(false);
  const [showDiviceOption, setShowDiviceOption] = useState(false);

  useEffect(() => {
    setConnectChange(!connectChange);
  }, [bleDeviceStore.connectedDevices]);

  useEffect(() => {
    reaction(
      () => bleDeviceStore.connectedDevices,
      (connectedDevices, reaction) => {
        if (connectedDevices.length > 0) {
          setShowDiviceOption(true);
        } else {
          setShowDiviceOption(false);
        }
      },
    );
  }, []);

  const renderHeader = observer(() => (
    <View style={{ marginTop: 20, width: '100%' }}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.buttonView,
          { marginHorizontal: 10, height: 40, alignItems: 'center' },
        ]}
        onPress={() => {
          bleDeviceStore.isScaning
            ? bleDeviceStore.stopScanDevices()
            : bleDeviceStore.scanDevices();
        }}
      >
        <Text style={styles.buttonText}>
          {bleDeviceStore.isScaning ? '正在搜索中' : '搜索蓝牙'}
        </Text>
      </TouchableOpacity>

      <Text style={{ marginLeft: 10, marginTop: 10, marginBottom: 10 }}>
        可用设备
      </Text>
      <View style={{ height: 1, backgroundColor: '#cccccc' }} />
    </View>
  ));

  const renderFooter = () => (
    <View style={{ marginTop: 20 }} displ>
      <View style={{ height: 1, backgroundColor: '#cccccc' }} />
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.buttonView,
          { marginHorizontal: 10, height: 40, alignItems: 'center' },
        ]}
        onPress={() => {
          bleOnekeyConnect
            .getConnect()
            .then((connect) => connect.getFeatures())
            .then((features) => {
              toastLong(JSON.stringify(features));
            })
            .catch((err) => {
              console.error('getFeatures 获取失败', err);
            });
        }}
      >
        <Text style={styles.buttonText}>获取硬件信息</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = (props) => {
    const device = props.item;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={!!bleDeviceStore.isConnecting}
        onPress={() => {
          bleDeviceStore.connect(device);
        }}
        style={styles.item}
      >
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ color: 'black' }}>
            {device.name ? device.name : ''}
          </Text>
          <Text style={{ color: 'red', marginLeft: 50 }}>
            {device.connecting ? '连接中...' : ''}
          </Text>
        </View>
        <Text>{device.id}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Observer>
      {() => (
        <SafeAreaView style={styles.container}>
          <FlatList
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            data={bleDeviceStore.findedDevices}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={showDiviceOption ? renderFooter : null}
            extraData={(connectChange, bleDeviceStore.isConnecting)}
          />
        </SafeAreaView>
      )}
    </Observer>
  );
};

export default BleDeviceDemo;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: 'white',
    marginTop: Platform.OS == 'ios' ? 50 : 30,
  },
  item: {
    flexDirection: 'column',
    borderColor: 'rgb(235,235,235)',
    borderStyle: 'solid',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingVertical: 8,
  },
  buttonView: {
    height: 30,
    backgroundColor: 'rgb(33, 150, 243)',
    paddingHorizontal: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
  },
});
