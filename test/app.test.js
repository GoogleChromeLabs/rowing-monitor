import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createMockDocument } from './mocks/mock-dom.js';
import { MockIDBFactory } from './mocks/mock-indexeddb.js';
import {
  createMockPM5Device,
  encodeGeneralStatus,
  encodeWorkoutEnd,
  PM5_CHARACTERISTICS,
  PM5_SERVICES
} from './mocks/mock-bluetooth.js';

describe('App', () => {
  let App;
  let mockDoc;
  let mockDevice;
  let originalWindow;
  let originalDoc;
  let originalScreen;
  const originalNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  beforeEach(async () => {
    mockDoc = createMockDocument();
    mockDevice = createMockPM5Device({
      serialNumber: 'SN-TEST-1234'
    });

    originalWindow = globalThis.window;
    originalDoc = globalThis.document;
    originalScreen = globalThis.screen;

    globalThis.window = {
      indexedDB: new MockIDBFactory(),
      FontFace: function() {},
      document: mockDoc
    };
    globalThis.document = mockDoc;
    globalThis.screen = { keepAwake: false };

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        bluetooth: {
          requestDevice: mock.fn(async () => mockDevice)
        },
        serviceWorker: {
          register: mock.fn(async () => ({}))
        }
      },
      configurable: true,
      writable: true
    });

    // Dynamically import App so environment is already present
    const appModule = await import('../src/js/app.js');
    App = appModule.default;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDoc;
    globalThis.screen = originalScreen;
    if (originalNavDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavDesc);
    }
  });

  it('sets up DOM references and tab switching in setup()', () => {
    const app = new App();
    app.setup();

    assert.ok(app.pm5);
    assert.ok(app.logbook);
    assert.strictEqual(app.statusText, mockDoc.statusEl);
    assert.strictEqual(app.timeText, mockDoc.timeEl);
    assert.strictEqual(app.distanceText, mockDoc.distanceEl);
    assert.strictEqual(app.btOnOffSwitch, mockDoc.switchEl);
  });

  it('connects to PM5 and updates UI', async () => {
    const app = new App();
    app.setup();

    await app.connect();

    assert.strictEqual(globalThis.screen.keepAwake, true);
    assert.strictEqual(mockDoc.statusEl.textContent, 'Connected to: SN-TEST-1234');
    assert.strictEqual(mockDoc.switchEl.checked, true);
  });

  it('updates time and distance when receiving general-status event', async () => {
    const app = new App();
    app.setup();

    await app.connect();

    const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
    const statusChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.generalStatus);

    statusChar.emitValueChanged(encodeGeneralStatus({
      timeElapsedSeconds: 65, // 00:01:05
      distanceMeters: 250.5
    }));

    // Date(65 * 1000) corresponds to 65 seconds
    const expectedTime = app.timeText.textContent;
    assert.ok(expectedTime.endsWith('01:05'));
    assert.strictEqual(mockDoc.distanceEl.textContent, '250.50');
  });

  it('saves workout and updates table when receiving workout-end event', async () => {
    const app = new App();
    app.setup();

    await app.connect();

    const rowingService = await mockDevice.gatt.getPrimaryService(PM5_SERVICES.rowing);
    const summaryChar = await rowingService.getCharacteristic(PM5_CHARACTERISTICS.workoutEndSummary);

    const initialRowsCount = mockDoc.logbookTable.children.length;

    summaryChar.emitValueChanged(encodeWorkoutEnd({
      logEntryDate: 100,
      logEntryTime: 200,
      timeElapsedSeconds: 300,
      distanceMeters: 1000,
      avgStrokeRate: 26,
      averagePaceSeconds: 150.0
    }));

    // Allow microtasks to complete saving workout
    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(mockDoc.logbookTable.children.length, initialRowsCount + 1);
    const newRow = mockDoc.logbookTable.children[mockDoc.logbookTable.children.length - 1];
    const distanceCell = newRow.querySelector('.logentry__distance');
    assert.strictEqual(distanceCell.textContent, 1000);
  });

  it('resets UI on disconnect event', async () => {
    const app = new App();
    app.setup();

    await app.connect();
    assert.strictEqual(mockDoc.switchEl.checked, true);
    assert.strictEqual(globalThis.screen.keepAwake, true);

    // Trigger disconnect on device
    mockDevice.gatt.disconnect();

    assert.strictEqual(mockDoc.switchEl.checked, false);
    assert.strictEqual(mockDoc.statusEl.textContent, 'Disconnected');
    assert.strictEqual(globalThis.screen.keepAwake, false);
  });

  it('disconnect() method calls pm5.disconnect()', async () => {
    const app = new App();
    app.setup();
    await app.connect();

    const pm5DisconnectSpy = mock.method(app.pm5, 'disconnect');
    await app.disconnect();

    assert.strictEqual(pm5DisconnectSpy.mock.callCount(), 1);
  });

  it('fillLogbook() loads workouts, renders them, and hides no-workout indicator', async () => {
    const app = new App();
    app.setup();

    // Save sample workouts in logbook
    await app.logbook.saveWorkout({
      date: new Date('2023-01-01T12:00:00Z'),
      distance: 2000,
      timeElapsed: 480
    });
    await app.logbook.saveWorkout({
      date: new Date('2023-01-02T12:00:00Z'),
      distance: 5000,
      timeElapsed: 1200
    });

    mockDoc.logbookTable.children = []; // clear table
    const fillPromise = app.fillLogbook();
    if (fillPromise && typeof fillPromise.then === 'function') {
      await fillPromise;
    } else {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    assert.strictEqual(mockDoc.logbookTable.children.length, 2);
    assert.ok(mockDoc.noWorkout.classList.has('no-workout_hidden'));
  });
});
