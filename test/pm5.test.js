import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import PM5 from '../src/js/pm5.js';
import {
  createMockPM5Device,
  encodeGeneralStatus,
  encodeWorkoutEnd,
  PM5_SERVICES,
  PM5_CHARACTERISTICS
} from './mocks/mock-bluetooth.js';

describe('PM5', () => {
  let mockDevice;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(() => {
    mockDevice = createMockPM5Device();

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        bluetooth: {
          requestDevice: mock.fn(async (options) => {
            return mockDevice;
          })
        }
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    }
  });

  describe('initial state', () => {
    it('initializes with default state', () => {
      const pm5 = new PM5();
      assert.strictEqual(pm5.connected, undefined);
      assert.ok(pm5.idObjectMap instanceof Map);
      assert.strictEqual(pm5.idObjectMap.size, 0);
      assert.deepStrictEqual(pm5.filters, {
        filters: [{services: [PM5_SERVICES.discovery]}],
        optionalServices: [
          PM5_SERVICES.information,
          PM5_SERVICES.control,
          PM5_SERVICES.rowing
        ]
      });
    });
  });

  describe('connect', () => {
    it('rejects if navigator.bluetooth is not available', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true,
        writable: true
      });
      const pm5 = new PM5();

      await assert.rejects(
          async () => {
            await pm5.connect();
          },
          {
            name: 'Error',
            message: 'Bluetooth API not available'
          }
      );
    });

    it('requests device with correct filters and connects gatt', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      assert.strictEqual(globalThis.navigator.bluetooth.requestDevice.mock.callCount(), 1);
      const passedFilters = globalThis.navigator.bluetooth.requestDevice.mock.calls[0].arguments[0];
      assert.deepStrictEqual(passedFilters, pm5.filters);

      assert.strictEqual(pm5.device, mockDevice);
      assert.strictEqual(pm5.server, mockDevice.gatt);
      assert.strictEqual(pm5.connected, true);
    });

    it('rejects if requestDevice fails (e.g. user cancels dialog)', async () => {
      globalThis.navigator.bluetooth.requestDevice = mock.fn(async () => {
        throw new Error('User cancelled');
      });

      const pm5 = new PM5();
      await assert.rejects(
          async () => {
            await pm5.connect();
          },
          {
            name: 'Error',
            message: 'User cancelled'
          }
      );
      assert.strictEqual(pm5.connected, undefined);
    });

    it('handles gattserverdisconnected event by clearing cache and dispatching disconnect', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      // Populate idObjectMap to ensure it gets cleared
      pm5.idObjectMap.set('test-key', 'test-value');
      assert.strictEqual(pm5.idObjectMap.size, 1);

      const disconnectListener = mock.fn();
      pm5.addEventListener('disconnect', disconnectListener);

      // Simulate disconnect event from device
      mockDevice.gatt.disconnect();

      assert.strictEqual(pm5.idObjectMap.size, 0);
      assert.strictEqual(disconnectListener.mock.callCount(), 1);
      assert.deepStrictEqual(disconnectListener.mock.calls[0].arguments[0], {
        type: 'disconnect'
      });
      assert.strictEqual(pm5.connected, false);
    });
  });

  describe('disconnect', () => {
    it('resolves safely when no device is connected', async () => {
      const pm5 = new PM5();
      await assert.doesNotReject(async () => {
        await pm5.disconnect();
      });
    });

    it('calls gatt.disconnect when connected', async () => {
      const pm5 = new PM5();
      await pm5.connect();
      assert.strictEqual(pm5.connected, true);

      const disconnectSpy = mock.method(mockDevice.gatt, 'disconnect');
      await pm5.disconnect();

      assert.strictEqual(disconnectSpy.mock.callCount(), 1);
    });
  });

  describe('service and characteristic resolution and caching', () => {
    it('caches services in idObjectMap', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const getPrimaryServiceSpy = mock.method(mockDevice.gatt, 'getPrimaryService');

      const serviceDef = {id: PM5_SERVICES.information};
      const service1 = await pm5._getService(serviceDef);
      assert.strictEqual(getPrimaryServiceSpy.mock.callCount(), 1);
      assert.ok(service1);

      // Second call should return cached instance
      const service2 = await pm5._getService(serviceDef);
      assert.strictEqual(getPrimaryServiceSpy.mock.callCount(), 1);
      assert.strictEqual(service1, service2);
    });

    it('caches characteristics in idObjectMap', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const infoService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.information);
      const getCharSpy = mock.method(infoService, 'getCharacteristic');

      const charDef = {
        id: PM5_CHARACTERISTICS.serialNumber,
        service: {id: PM5_SERVICES.information}
      };

      const char1 = await pm5._getCharacteristic(charDef);
      assert.strictEqual(getCharSpy.mock.callCount(), 1);
      assert.ok(char1);

      // Second call should return cached instance
      const char2 = await pm5._getCharacteristic(charDef);
      assert.strictEqual(getCharSpy.mock.callCount(), 1);
      assert.strictEqual(char1, char2);
    });
  });

  describe('device information', () => {
    let pm5;

    beforeEach(async () => {
      mockDevice = createMockPM5Device({
        manufacturerName: 'Concept2 Inc.',
        hardwareRevision: 'HW-Rev-3',
        serialNumber: 'SN-987654321',
        firmwareVersion: 'FW-32.05'
      });
      pm5 = new PM5();
      await pm5.connect();
    });

    it('reads manufacturer name', async () => {
      const name = await pm5.getManufacturerName();
      assert.strictEqual(name, 'Concept2 Inc.');
    });

    it('reads hardware revision', async () => {
      const rev = await pm5.getHardwareRevision();
      assert.strictEqual(rev, 'HW-Rev-3');
    });

    it('reads serial number', async () => {
      const sn = await pm5.getSerialNumber();
      assert.strictEqual(sn, 'SN-987654321');
    });

    it('reads firmware version', async () => {
      const fw = await pm5.getFirmwareVersion();
      assert.strictEqual(fw, 'FW-32.05');
    });

    it('retrieves combined PM5 information object', async () => {
      const info = await pm5.getPm5Information();
      assert.deepStrictEqual(info, {
        manufacturer: 'Concept2 Inc.',
        hwVersion: 'HW-Rev-3',
        serialNumber: 'SN-987654321',
        firmwareVersion: 'FW-32.05'
      });
    });
  });

  describe('general-status events', () => {
    it('sets up notifications and dispatches parsed general-status data', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const statusListener = mock.fn();
      await pm5.addEventListener('general-status', statusListener);

      const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
      const statusChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.generalStatus);

      assert.strictEqual(statusChar.notificationsStarted, true);

      // Emit simulated packet: 123.45 seconds (12345 hundredths = [57, 48, 0]), 500.0 m (5000 tenths = [136, 19, 0])
      const packet = encodeGeneralStatus({
        timeElapsedSeconds: 123.45,
        distanceMeters: 500.0
      });
      statusChar.emitValueChanged(packet);

      assert.strictEqual(statusListener.mock.callCount(), 1);
      const event = statusListener.mock.calls[0].arguments[0];

      assert.strictEqual(event.type, 'general-status');
      assert.strictEqual(event.source, pm5);
      assert.ok(event.raw instanceof DataView);
      assert.strictEqual(event.data.timeElapsed, 123.45);
      assert.strictEqual(event.data.distance, 500.0);
    });

    it('handles large 24-bit distance and time values correctly', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const statusListener = mock.fn();
      await pm5.addEventListener('general-status', statusListener);

      const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
      const statusChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.generalStatus);

      // 42,195.0 meters (marathon) and 9,000.55 seconds (2.5 hours)
      const packet = encodeGeneralStatus({
        timeElapsedSeconds: 9000.55,
        distanceMeters: 42195.0
      });
      statusChar.emitValueChanged(packet);

      assert.strictEqual(statusListener.mock.callCount(), 1);
      const event = statusListener.mock.calls[0].arguments[0];
      assert.ok(Math.abs(event.data.timeElapsed - 9000.55) < 0.001);
      assert.strictEqual(event.data.distance, 42195.0);
    });
  });

  describe('workout-end events', () => {
    it('sets up notifications and dispatches full parsed workout-end summary', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const workoutListener = mock.fn();
      await pm5.addEventListener('workout-end', workoutListener);

      const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
      const summaryChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.workoutEndSummary);

      assert.strictEqual(summaryChar.notificationsStarted, true);

      const packet = encodeWorkoutEnd({
        logEntryDate: 1346,
        logEntryTime: 1000,
        timeElapsedSeconds: 120.50,
        distanceMeters: 500.0,
        avgStrokeRate: 28,
        endingHeartRate: 155,
        averageHeartRate: 148,
        minHeartRate: 110,
        maxHeartRate: 162,
        averageDragFactor: 125,
        recoveryHeartRate: 115,
        workoutType: 1,
        averagePaceSeconds: 120.5
      });
      summaryChar.emitValueChanged(packet);

      assert.strictEqual(workoutListener.mock.callCount(), 1);
      const event = workoutListener.mock.calls[0].arguments[0];

      assert.strictEqual(event.type, 'workout-end');
      assert.strictEqual(event.source, pm5);
      assert.ok(event.raw instanceof DataView);
      assert.ok(event.data.date instanceof Date);

      assert.strictEqual(event.data.logEntryDate, 1346);
      assert.strictEqual(event.data.logEntryTime, 1000);
      assert.strictEqual(event.data.timeElapsed, 120.50);
      assert.strictEqual(event.data.distance, 500.0);
      assert.strictEqual(event.data.avgStrokeRate, 28);
      assert.strictEqual(event.data.endingHeartRate, 155);
      assert.strictEqual(event.data.averageHeartRate, 148);
      assert.strictEqual(event.data.minHeartRate, 110);
      assert.strictEqual(event.data.maxHeartRate, 162);
      assert.strictEqual(event.data.averageDragFactor, 125);
      assert.strictEqual(event.data.recoveryHeartRate, 115);
      assert.strictEqual(event.data.workoutType, 1);
      assert.strictEqual(event.data.averagePace, 120.5);
    });
  });

  describe('removeEventListener', () => {
    it('removes listener so it is no longer called', async () => {
      const pm5 = new PM5();
      await pm5.connect();

      const listener = mock.fn();
      await pm5.addEventListener('general-status', listener);

      const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
      const statusChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.generalStatus);

      statusChar.emitValueChanged(encodeGeneralStatus({timeElapsedSeconds: 10, distanceMeters: 50}));
      assert.strictEqual(listener.mock.callCount(), 1);

      pm5.removeEventListener('general-status', listener);

      statusChar.emitValueChanged(encodeGeneralStatus({timeElapsedSeconds: 20, distanceMeters: 100}));
      assert.strictEqual(listener.mock.callCount(), 1); // Not called again
    });
  });
});
