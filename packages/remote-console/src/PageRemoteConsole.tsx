/* eslint-disable react/destructuring-assignment, react/sort-comp, react/state-in-constructor, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, react/no-access-state-in-setstate, @typescript-eslint/no-unsafe-member-access */
import React from 'react';

import { Console, Hook } from 'console-feed';
import { replicator } from 'console-feed/lib/Transform';
import update from 'immutability-helper';
import Head from 'next/head';

function domParentMatches(n: HTMLElement, selector: string) {
  let node = n;
  while (node) {
    // node.matches() not existing in document element
    if (node.matches && node.matches(selector)) {
      return true;
    }
    node = node.parentNode as HTMLElement;
  }
  return false;
}

class App extends React.Component {
  override state = {
    wsOpen: false,
    isDarkMode: true,
    logs: [
      // right arrow icon
      {
        method: 'command',
        data: ['command Sample Message'],
        timestamp: this.getTimestamp(),
      },
      // left arrow icon
      {
        method: 'result',
        data: ['result Sample Message'],
        timestamp: this.getTimestamp(),
      },
    ] as any[],
    // 'log' | 'debug' | 'info' | 'warn' | 'error' | 'table' | 'clear' | 'time' | 'timeEnd' | 'count' | 'assert' | 'command' | 'result'
    filter: [],
    searchKeywords: '',
    sendText: '',
  };

  getNumberStringWithWidth(num: number, width: number) {
    const str = num.toString();
    if (width > str.length) return '0'.repeat(width - str.length) + str;
    return str.substr(0, width);
  }

  getTimestamp() {
    const date = new Date();
    const h = this.getNumberStringWithWidth(date.getHours(), 2);
    const min = this.getNumberStringWithWidth(date.getMinutes(), 2);
    const sec = this.getNumberStringWithWidth(date.getSeconds(), 2);
    const ms = this.getNumberStringWithWidth(date.getMilliseconds(), 3);
    return `${h}:${min}:${sec}.${ms}`;
  }

  ws: WebSocket | null = null;

  appendLogs = (logs: any) => {
    // eslint-disable-next-line no-param-reassign
    logs = [].concat(logs).filter(Boolean);
    const logsWithTime = logs.map((log: any) => {
      log.timestamp = this.getTimestamp();
      return log;
    });
    this.setState((state) => update(state, { logs: { $push: logsWithTime } }));
  };

  override componentDidMount() {
    Hook(window.console, this.appendLogs);
    const ws = new WebSocket('ws://127.0.0.1:8136');
    this.ws = ws;
    ws.addEventListener('message', (event) => {
      // const logs = [].concat(JSON.parse(event.data));
      // const logs = JSON.parse(event.data);
      const log = replicator.decode(event.data);
      this.appendLogs(log);
    });
    ws.addEventListener('open', () => this.setState({ wsOpen: true }));
  }

  switch = () => {
    // eslint-disable-next-line react/no-access-state-in-setstate
    const filter = this.state.filter.length === 0 ? ['log'] : [];
    this.setState({
      filter,
    });
  };

  clear = () => {
    this.setState({
      logs: [],
    });
  };

  handleClickConsolePanel = ((event: MouseEvent) => {
    const ele = event.target as HTMLElement;
    if (
      ele &&
      ele.matches &&
      ele.matches('span') &&
      domParentMatches(ele, '[data-method=command]')
    ) {
      if (ele.innerText) {
        this.setState({ sendText: ele.innerText.trim() });
      }
    }
  }) as any;

  // @ts-ignore
  handleKeywordsChange = ({ target: { value: searchKeywords } }) => {
    this.setState({ searchKeywords });
  };

  override render() {
    const { isDarkMode, wsOpen } = this.state;
    // @ts-ignore
    return (
      <div
        style={{
          margin: '0',
          color: isDarkMode ? '#fff' : '#242424',
          backgroundColor: isDarkMode ? '#242424' : '#fff',
          height: '100vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <Head>
          <title>OneKey Remote Console</title>
        </Head>
        <div
          style={{
            backgroundColor: isDarkMode ? '#242424' : '#fff',
            position: 'sticky',
            top: 0,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '5px',
            zIndex: 9999,
          }}
        >
          <button type="button" onClick={this.clear}>
            Clear
          </button>
          <select
            onChange={(e) => {
              let f = e.target.value;
              f = f === 'ALL' ? '' : f;
              this.setState({ filter: [f].filter(Boolean) });
            }}
          >
            {['ALL', 'log', 'debug', 'info', 'warn', 'error', 'command'].map(
              (name) => (
                <option value={name} key={name}>
                  {name}
                </option>
              ),
            )}
          </select>
          <input placeholder="search" onChange={this.handleKeywordsChange} />
          <label>
            <input
              type="checkbox"
              checked={isDarkMode}
              onChange={(e) => {
                this.setState({ isDarkMode: e.target.checked });
              }}
            />
            Toggle dark mode
          </label>
          {!wsOpen && (
            <button type="button" onClick={() => window.location.reload()}>
              WebSocket not Ready, please reload page
            </button>
          )}
        </div>

        <div
          role="none"
          style={{ minHeight: '100%' }}
          onClick={this.handleClickConsolePanel}
        >
          <Console
            logs={this.state.logs}
            variant={isDarkMode ? 'dark' : 'light'}
            filter={this.state.filter}
            searchKeywords={this.state.searchKeywords}
          />
        </div>

        <div
          style={{
            position: 'sticky',
            zIndex: 10,
            left: 0,
            bottom: 0,
            padding: '0 12px',
          }}
        >
          <input
            value={this.state.sendText}
            onChange={(e) => this.setState({ sendText: e.target.value || '' })}
            style={{ width: '100%', fontSize: 16 }}
            onKeyPress={(event) => {
              if (event.code === 'Enter') {
                // Cancel the default action, if needed
                event.preventDefault();
                this.setState({
                  sendText: '',
                });
                const customCommand = {
                  type: 'RemoteConsoleCustomCommand',
                  // payload: `console.log(${this.state.sendText})`,
                  payload: `${this.state.sendText}`,
                };
                this.appendLogs({
                  method: 'command',
                  data: [customCommand.payload],
                  timestamp: this.getTimestamp(),
                });
                this.ws?.send(JSON.stringify(customCommand));
              }
            }}
          />
        </div>
      </div>
    );
  }
}

export default App;
