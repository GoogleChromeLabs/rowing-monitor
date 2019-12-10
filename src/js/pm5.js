/**
 * Copyright 2015-2016, Google, Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import EventTarget from './eventtarget';

const MID_MULTIPLIER = 256;
const HIGH_MULTIPLIER = MID_MULTIPLIER * 256;

const services = {
  information: {id: 'ce060010-43e5-11e4-916c-0800200c9a66'},
  rowing: {id: 'ce060030-43e5-11e4-916c-0800200c9a66'},
  control: {id: 'ce060020-43e5-11e4-916c-0800200c9a66'},
  discovery: {id: 'ce060000-43e5-11e4-916c-0800200c9a66'}
};

const characteristics = {
  informationService: {
    serialNumber: {
      id: 'ce060012-43e5-11e4-916c-0800200c9a66',
      service: services.information
    },
    hardwareRevision: {
      id: 'ce060013-43e5-11e4-916c-0800200c9a66',
      service: services.information
    },
    manufacturerName: {
      id: 'ce060014-43e5-11e4-916c-0800200c9a66',
      service: services.information
    },
    firmwareVersion: {
      id: 'ce060015-43e5-11e4-916c-0800200c9a66',
      service: services.information
    }
  },
  rowingService: {
    generalStatus: {
      id: 'ce060031-43e5-11e4-916c-0800200c9a66',
      service: services.rowing
    },
    workoutEndSummary: {
      // id: 'ce060033-43e5-11e4-916c-0800200c9a66',
      id: 'ce060039-43e5-11e4-916c-0800200c9a66',
      service: services.rowing
    }
  }
};

export default class PM5 {
  constructor() {
    this.idObjectMap = new Map();
    this.eventTarget = new EventTarget();
    this.filters = {
      filters: [{services: [services.discovery.id]}],
      optionalServices: [services.information.id, services.control.id, services.rowing.id]
    };
  }

  addEventListener(type, callback) {
    this.eventTarget.addEventListener(type, callback);
    switch (type) {
      case 'general-status': {
        return this._addGeneralStatusListener();
      }
      case 'workout-end': {
        return this._addWorkoutEndListener();
      }
    }
  }

  removeEventListener(type, callback) {
    return this.eventTarget.removeEventListener(type, callback);
  }

  connect() {
    if (!navigator.bluetooth) {
      return Promise.reject(new Error('Bluetooth API not available'));
    }

    return navigator.bluetooth.requestDevice(this.filters)
        .then(device => {
          this.device = device;
          this.device.addEventListener('gattserverdisconnected', () => {
            this.idObjectMap.clear();
            this.eventTarget.dispatchEvent({type: 'disconnect'});
          });
          return device.gatt.connect();
        })
        .then(server => {
          this.server = server;
          return Promise.resolve();
        });
  }

  disconnect() {
    if (!this.device || !this.device.gatt) {
      return Promise.resolve();
    }
    return this.device.gatt.disconnect();
  }

  get connected() {
    return this.device && this.device.gatt.connected;
  }

  _getService(service) {
    const serviceObject = this.idObjectMap.get(service.id);
    if (serviceObject) {
      return Promise.resolve(serviceObject);
    }

    return this.server.getPrimaryService(service.id)
        .then(s => {
          this.idObjectMap.set(service.id, s);
          return Promise.resolve(s);
        });
  }

  _getCharacteristic(characteristic) {
    const characteristicObject = this.idObjectMap.get(characteristic.id);
    if (characteristicObject) {
      return Promise.resolve(characteristicObject);
    }

    return this._getService(characteristic.service)
        .then(service => {
          return service.getCharacteristic(characteristic.id);
        })
        .then(c => {
          this.idObjectMap.set(characteristic.id, c);
          return Promise.resolve(c);
        });
  }

  _setupCharacteristicValueListener(characteristic, callback) {
    const pm5 = this;
    return this._getCharacteristic(characteristic)
        .then(c => {
          return c.startNotifications();
        })
        .then(c => {
          c.addEventListener('characteristicvaluechanged', e => {
            callback(pm5, e);
          });
          return Promise.resolve();
        });
  }

  /**
   * Data bytes packed as follows:
   *  0: Log Entry Date Lo,
   *  1: Log Entry Date Hi,
   *  2: Log Entry Time Lo,
   *  3: Log Entry Time Hi,
   *  4: Elapsed Time Lo (0.01 sec lsb),
   *  5: Elapsed Time Mid,
   *  6: Elapsed Time High,
   *  7: Distance Lo (0.1 m lsb),
   *  8: Distance Mid,
   *  9: Distance High,
   * 10: Average Stroke Rate,
   * 11: Ending Heartrate,
   * 12: Average Heartrate,
   * 13: Min Heartrate,
   * 14: Max Heartrate,
   * 15: Drag Factor Average,
   * 16: Recovery Heart Rate, (zero = not valid data. After 1 minute of rest/recovery, PM5 sends
   *     this data as a revised End Of Workout summary data characteristic unless the monitor has
   *     been turned off or a new workout started)
   * 17: Workout Type,
   * 18: Avg Pace Lo (0.1 sec lsb)
   * 19: Avg Pace Hi
   */
  _addWorkoutEndListener() {
    return this._setupCharacteristicValueListener(
        characteristics.rowingService.workoutEndSummary, (pm5, e) => {
          const valueArray = new Uint8Array(e.target.value.buffer);
          const logEntryDate = valueArray[0] + valueArray[1] * MID_MULTIPLIER;
          const logEntryTime = valueArray[2] + valueArray[3] * MID_MULTIPLIER;
          const timeElapsed = (valueArray[4] + (valueArray[5] * MID_MULTIPLIER) +
            (valueArray[6] * HIGH_MULTIPLIER)) * 0.01;
          const distance = (valueArray[7] + (valueArray[8] * MID_MULTIPLIER) +
            (valueArray[9] * HIGH_MULTIPLIER)) * 0.1;
          const averagePace = (valueArray[18] + valueArray[19] * MID_MULTIPLIER) * 0.1;
          const event = {
            type: 'workout-end',
            source: pm5,
            raw: e.target.value,
            data: {
              date: new Date(),
              logEntryDate: logEntryDate,
              logEntryTime: logEntryTime,
              timeElapsed: timeElapsed,
              distance: distance,
              avgStrokeRate: valueArray[10],
              endingHeartRate: valueArray[11],
              averageHeartRate: valueArray[12],
              minHeartRate: valueArray[13],
              maxHeartRate: valueArray[14],
              averageDragFactor: valueArray[15],
              recoveryHeartRate: valueArray[16],
              workoutType: valueArray[17],
              averagePace: averagePace
            }
          };
          pm5.eventTarget.dispatchEvent(event);
        });
  }

  _addGeneralStatusListener() {
    return this._setupCharacteristicValueListener(
        characteristics.rowingService.generalStatus, (pm5, e) => {
          const valueArray = new Uint8Array(e.target.value.buffer);
          const timeElapsed = (valueArray[0] + (valueArray[1] * MID_MULTIPLIER) +
            (valueArray[2] * HIGH_MULTIPLIER)) * 0.01;
          const distance = (valueArray[3] + (valueArray[4] * MID_MULTIPLIER) +
            (valueArray[5] * HIGH_MULTIPLIER)) * 0.1;
          const event = {
            type: 'general-status',
            source: pm5,
            raw: e.target.value,
            data: {
              distance: distance,
              timeElapsed: timeElapsed
            }
          };
          pm5.eventTarget.dispatchEvent(event);
        });
  }

  _getStringCharacteristicValue(characteristic) {
    const decoder = new TextDecoder('utf-8');
    return this._getCharacteristic(characteristic)
        .then(c => {
          return c.readValue();
        })
        .then(value => {
          return decoder.decode(value);
        });
  }

  getFirmwareVersion() {
    return this._getStringCharacteristicValue(characteristics.informationService.firmwareVersion);
  }

  getHardwareRevision() {
    return this._getStringCharacteristicValue(characteristics.informationService.hardwareRevision);
  }

  getSerialNumber() {
    return this._getStringCharacteristicValue(characteristics.informationService.serialNumber);
  }

  getManufacturerName() {
    return this._getStringCharacteristicValue(characteristics.informationService.manufacturerName);
  }

  getPm5Information() {
    const pm5Information = {};
    return this.getManufacturerName()
        .then(manufacturer => {
          pm5Information.manufacturer = manufacturer;
          return this.getHardwareRevision();
        })
        .then(hwVersion => {
          pm5Information.hwVersion = hwVersion;
          return this.getSerialNumber();
        })
        .then(serialNumber => {
          pm5Information.serialNumber = serialNumber;
          return this.getFirmwareVersion();
        })
        .then(firmwareVersion => {
          pm5Information.firmwareVersion = firmwareVersion;
          return Promise.resolve(pm5Information);
        });
  }
}
