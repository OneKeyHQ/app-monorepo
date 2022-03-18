/* eslint-disable react/destructuring-assignment, react/sort-comp, react/state-in-constructor, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, react/no-access-state-in-setstate, @typescript-eslint/no-unsafe-member-access */
import React from 'react';

import { Console, Decode, Hook } from 'console-feed';
import update from 'immutability-helper';
import Head from 'next/head';

class App extends React.Component {
  state = {
    wsOpen: false,
    isDarkMode: true,
    logs: [
      {
        method: 'result',
        data: ['Result'],
        timestamp: this.getTimestamp(),
      },
      {
        method: 'command',
        data: ['Command'],
        timestamp: this.getTimestamp(),
      },
    ] as any[],
    // 'log' | 'debug' | 'info' | 'warn' | 'error' | 'table' | 'clear' | 'time' | 'timeEnd' | 'count' | 'assert' | 'command' | 'result'
    filter: [],
    searchKeywords: '',
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

  componentDidMount() {
    const appendLogs = (logs: any) => {
      const decoded = Decode(logs);
      decoded.timestamp = this.getTimestamp();
      this.setState((state) => update(state, { logs: { $push: [decoded] } }));
    };
    Hook(window.console, appendLogs);
    const ws = new WebSocket('ws://127.0.0.1:8136');
    ws.addEventListener('message', (event) => {
      const logs = [].concat(JSON.parse(event.data));
      appendLogs(logs);
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

  // @ts-ignore
  handleKeywordsChange = ({ target: { value: searchKeywords } }) => {
    this.setState({ searchKeywords });
  };

  render() {
    const { isDarkMode, wsOpen } = this.state;
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
            {['ALL', 'log', 'debug', 'info', 'warn', 'error'].map((name) => (
              <option value={name}>{name}</option>
            ))}
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

        <Console
          logs={this.state.logs}
          variant={isDarkMode ? 'dark' : 'light'}
          filter={this.state.filter}
          searchKeywords={this.state.searchKeywords}
        />
      </div>
    );
  }
}

export default App;
