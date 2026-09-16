/**
 * Mock implementation of Web Bluetooth API for Concept2 PM5 testing.
 */

export class MockBluetoothCharacteristic {
  constructor(uuid, service) {
    this.uuid = uuid;
    this.service = service;
    this.value = null;
    this._listeners = new Map();
    this.notificationsStarted = false;
  }

  addEventListener(type, callback) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    const callbacks = this._listeners.get(type);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  dispatchEvent(event) {
    const callbacks = this._listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(cb => cb(event));
    }
  }

  async startNotifications() {
    this.notificationsStarted = true;
    return this;
  }

  async readValue() {
    return this.value;
  }

  setValue(uint8Array) {
    const buffer = uint8Array.buffer.slice(
        uint8Array.byteOffset,
        uint8Array.byteOffset + uint8Array.byteLength
    );
    this.value = new DataView(buffer);
  }

  emitValueChanged(uint8Array) {
    this.setValue(uint8Array);
    const event = {
      type: 'characteristicvaluechanged',
      target: this
    };
    this.dispatchEvent(event);
  }
}

export class MockBluetoothService {
  constructor(uuid, server) {
    this.uuid = uuid;
    this.server = server;
    this.characteristics = new Map();
  }

  addCharacteristic(uuid) {
    const char = new MockBluetoothCharacteristic(uuid, this);
    this.characteristics.set(uuid, char);
    return char;
  }

  async getCharacteristic(uuid) {
    const char = this.characteristics.get(uuid);
    if (!char) {
      throw new Error(`Characteristic ${uuid} not found on service ${this.uuid}`);
    }
    return char;
  }
}

export class MockBluetoothGATTServer {
  constructor(device) {
    this.device = device;
    this.connected = false;
    this.services = new Map();
  }

  addService(uuid) {
    const service = new MockBluetoothService(uuid, this);
    this.services.set(uuid, service);
    return service;
  }

  async connect() {
    this.connected = true;
    return this;
  }

  disconnect() {
    if (this.connected) {
      this.connected = false;
      this.device.dispatchEvent({type: 'gattserverdisconnected', target: this.device});
    }
  }

  async getPrimaryService(uuid) {
    const service = this.services.get(uuid);
    if (!service) {
      throw new Error(`Service ${uuid} not found`);
    }
    return service;
  }
}

export class MockBluetoothDevice {
  constructor(name = 'Concept2 PM5') {
    this.id = 'mock-pm5-device-id';
    this.name = name;
    this.gatt = new MockBluetoothGATTServer(this);
    this._listeners = new Map();
  }

  addEventListener(type, callback) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, new Set());
    }
    this._listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    const callbacks = this._listeners.get(type);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  dispatchEvent(event) {
    const callbacks = this._listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(cb => cb(event));
    }
  }
}

export const PM5_SERVICES = {
  discovery: 'ce060000-43e5-11e4-916c-0800200c9a66',
  information: 'ce060010-43e5-11e4-916c-0800200c9a66',
  control: 'ce060020-43e5-11e4-916c-0800200c9a66',
  rowing: 'ce060030-43e5-11e4-916c-0800200c9a66'
};

export const PM5_CHARACTERISTICS = {
  serialNumber: 'ce060012-43e5-11e4-916c-0800200c9a66',
  hardwareRevision: 'ce060013-43e5-11e4-916c-0800200c9a66',
  manufacturerName: 'ce060014-43e5-11e4-916c-0800200c9a66',
  firmwareVersion: 'ce060015-43e5-11e4-916c-0800200c9a66',
  generalStatus: 'ce060031-43e5-11e4-916c-0800200c9a66',
  workoutEndSummary: 'ce060039-43e5-11e4-916c-0800200c9a66'
};

export function createMockPM5Device(customData = {}) {
  const device = new MockBluetoothDevice(customData.name || 'Concept2 PM5 430123456');

  // Discovery service
  device.gatt.addService(PM5_SERVICES.discovery);

  // Control service
  device.gatt.addService(PM5_SERVICES.control);

  // Information service
  const infoService = device.gatt.addService(PM5_SERVICES.information);
  const encoder = new TextEncoder();

  const serialNumberChar = infoService.addCharacteristic(PM5_CHARACTERISTICS.serialNumber);
  serialNumberChar.setValue(encoder.encode(customData.serialNumber || '430123456'));

  const hwRevChar = infoService.addCharacteristic(PM5_CHARACTERISTICS.hardwareRevision);
  hwRevChar.setValue(encoder.encode(customData.hardwareRevision || '002'));

  const mfgChar = infoService.addCharacteristic(PM5_CHARACTERISTICS.manufacturerName);
  mfgChar.setValue(encoder.encode(customData.manufacturerName || 'Concept2'));

  const fwRevChar = infoService.addCharacteristic(PM5_CHARACTERISTICS.firmwareVersion);
  fwRevChar.setValue(encoder.encode(customData.firmwareVersion || '31.00'));

  // Rowing service
  const rowingService = device.gatt.addService(PM5_SERVICES.rowing);
  rowingService.addCharacteristic(PM5_CHARACTERISTICS.generalStatus);
  rowingService.addCharacteristic(PM5_CHARACTERISTICS.workoutEndSummary);

  return device;
}

export function encodeGeneralStatus({timeElapsedSeconds, distanceMeters}) {
  // timeElapsed is 24-bit little endian, unit = 0.01s (hundredths)
  // distance is 24-bit little endian, unit = 0.1m (tenths)
  const timeHundredths = Math.round(timeElapsedSeconds * 100);
  const distanceTenths = Math.round(distanceMeters * 10);

  const bytes = new Uint8Array(6);
  bytes[0] = timeHundredths & 0xFF;
  bytes[1] = (timeHundredths >> 8) & 0xFF;
  bytes[2] = (timeHundredths >> 16) & 0xFF;

  bytes[3] = distanceTenths & 0xFF;
  bytes[4] = (distanceTenths >> 8) & 0xFF;
  bytes[5] = (distanceTenths >> 16) & 0xFF;

  return bytes;
}

export function encodeWorkoutEnd({
  logEntryDate = 0,
  logEntryTime = 0,
  timeElapsedSeconds = 0,
  distanceMeters = 0,
  avgStrokeRate = 0,
  endingHeartRate = 0,
  averageHeartRate = 0,
  minHeartRate = 0,
  maxHeartRate = 0,
  averageDragFactor = 0,
  recoveryHeartRate = 0,
  workoutType = 0,
  averagePaceSeconds = 0
}) {
  const bytes = new Uint8Array(20);

  // 0-1: Log Entry Date (16-bit)
  bytes[0] = logEntryDate & 0xFF;
  bytes[1] = (logEntryDate >> 8) & 0xFF;

  // 2-3: Log Entry Time (16-bit)
  bytes[2] = logEntryTime & 0xFF;
  bytes[3] = (logEntryTime >> 8) & 0xFF;

  // 4-6: Elapsed Time (24-bit, 0.01 sec)
  const timeHundredths = Math.round(timeElapsedSeconds * 100);
  bytes[4] = timeHundredths & 0xFF;
  bytes[5] = (timeHundredths >> 8) & 0xFF;
  bytes[6] = (timeHundredths >> 16) & 0xFF;

  // 7-9: Distance (24-bit, 0.1 m)
  const distanceTenths = Math.round(distanceMeters * 10);
  bytes[7] = distanceTenths & 0xFF;
  bytes[8] = (distanceTenths >> 8) & 0xFF;
  bytes[9] = (distanceTenths >> 16) & 0xFF;

  // 10: Avg Stroke Rate
  bytes[10] = avgStrokeRate & 0xFF;

  // 11: Ending Heart Rate
  bytes[11] = endingHeartRate & 0xFF;

  // 12: Average Heart Rate
  bytes[12] = averageHeartRate & 0xFF;

  // 13: Min Heart Rate
  bytes[13] = minHeartRate & 0xFF;

  // 14: Max Heart Rate
  bytes[14] = maxHeartRate & 0xFF;

  // 15: Average Drag Factor
  bytes[15] = averageDragFactor & 0xFF;

  // 16: Recovery Heart Rate
  bytes[16] = recoveryHeartRate & 0xFF;

  // 17: Workout Type
  bytes[17] = workoutType & 0xFF;

  // 18-19: Avg Pace (16-bit, 0.1 sec)
  const paceTenths = Math.round(averagePaceSeconds * 10);
  bytes[18] = paceTenths & 0xFF;
  bytes[19] = (paceTenths >> 8) & 0xFF;

  return bytes;
}
