import NetInfo from '@react-native-community/netinfo';
import { getIpAddressesForHostname } from 'react-native-dns-lookup';
import { getRequests } from 'react-native-network-logger';
import Ping from 'react-native-ping';
import TcpSocket from 'react-native-tcp-socket';

export async function runNetworkDoctor() {
  console.log('Running Network Doctor...');
  try {
    console.log('Checking network connectivity...: ', NetInfo);
  } catch (error) {
    console.error('Network Doctor: Error checking network connectivity', error);
  }

  try {
    console.log('Performing DNS lookup for example.com...');
    const r = getIpAddressesForHostname('example.com');
    console.log('DNS lookup result for example.com: ', r);
  } catch (error) {
    console.error('Network Doctor: Error performing DNS lookup', error);
  }

  try {
    console.log('Retrieving network requests from logger...');
    const requests = getRequests();
    console.log('Network requests logged: ', requests);
  } catch (error) {
    console.error('Network Doctor: Error retrieving network requests', error);
  }

  try {
    console.log('Pinging example.com...');
    const pingResult = await Ping.start('example.com');
    console.log('Ping result for example.com: ', pingResult);
  } catch (error) {
    console.error('Network Doctor: Error pinging example.com', error);
  }

  try {
    console.log('Creating TCP socket to example.com:80...');
    const socket = TcpSocket.createConnection(
      { host: 'example.com', port: 80 },
      () => {
        console.log('TCP socket connected to example.com:80');
        socket.end();
      },
    );

    socket.on('error', (error) => {
      console.error('Network Doctor: Error with TCP socket connection', error);
    });
  } catch (error) {
    console.error('Network Doctor: Exception creating TCP socket', error);
  }
}
