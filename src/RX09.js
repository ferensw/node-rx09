'use strict';

const SerialPort = require('serialport').SerialPort;

const invariant = require('./invariant');
const stringPad = require('./stringPad');

class RX09 {
  constructor(serialPath) {
    const telegram = 'TXP';
    const address = 1; // Address for RS-232 is always 01.
    const execute = (channelID, direction) => getSerialPort(serialPath).then(
      serialPort => new Promise((resolve, reject) => {
        serialPort.write(
          telegram + ',' + stringPad('' + channelID, 2) + ',' + direction + '\r',
          error => error ? reject(error) : resolve()
        );
      })
    );

    // To prevent subsequent `stop` commands within ~600ms.
    let prevStop = Promise.resolve();

    this._channels = Array(16).fill(null).map((_, ii) => {
      const channelID = ii + 1;
      return {
        up() {
          return execute(channelID, 'A');
        },
        down() {
          return execute(channelID, 'B');
        },
        stop() {
          const result = prevStop.then(() => execute(channelID, 'C'));
          prevStop = prevStop.then(() => new Promise(resolve => {
            setTimeout(resolve, 600);
          }));
          return result;
        },
      };
    });
  }

  getChannel(channelID) {
    const ii = channelID - 1;
    invariant(
      this._channels.hasOwnProperty(ii),
      'Invalid channel ID: ' + channelID
    );
    return this._channels[ii];
  }

  getChannels(channelIDs) {
    if (channelIDs.length) {
      return channelIDs.map(channelID => this.getChannel(channelID));
    } else {
      return this._channels.slice(0);
    }
  }

  getChannelGroup(channelIDs) {
    const channels = this.getChannels(channelIDs);
    return {
      up() {
        return Promise.all(channels.map(channel => channel.up()));
      },
      down() {
        return Promise.all(channels.map(channel => channel.down()));
      },
      stop() {
        return Promise.all(channels.map(channel => channel.stop()));
      },
    };
  }
}

const getSerialPort = (serialPorts => function(serialPath) {
  if (!serialPorts.hasOwnProperty(serialPath)) {
    serialPorts[serialPath] = new Promise((resolve, reject) => {
      const serialPort = new SerialPort(serialPath, {
        baudRate: 57600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });
      serialPort.on('open', () => resolve(serialPort));
      serialPort.on('error', reject);
    });
  }
  return serialPorts[serialPath];
})({});

module.exports = RX09;
