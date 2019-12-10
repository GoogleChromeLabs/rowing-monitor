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

const DATABASE_NAME = 'pm5monitor';
const LOGBOOK_DATASTORE = 'logbook';

/**
 * A Logbook entry should contain:
 *  - Date
 *  - Distance
 *  - Workout time
 */
export default class Logbook {
  constructor() {
  }

  _getDatabase() {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME);
      request.onerror = err => {
        reject(err);
      };
      request.onsuccess = event => {
        resolve(event.target.result);
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        db.createObjectStore(LOGBOOK_DATASTORE, {autoIncrement: true});
      };
    });
  }

  loadWorkouts() {
    return this._getDatabase()
        .then(db => {
          const transaction = db.transaction(LOGBOOK_DATASTORE);
          const objectStore = transaction.objectStore(LOGBOOK_DATASTORE);
          const logbookRecords = [];
          return new Promise(resolve => {
            objectStore.openCursor().onsuccess = e => {
              const cursor = e.target.result;
              if (cursor) {
                logbookRecords.push(cursor.value);
                cursor.continue();
              } else {
                return resolve(logbookRecords);
              }
            };
          });
        });
  }

  saveWorkout(workout) {
    return this._getDatabase()
        .then(db => {
          return new Promise((resolve, reject) => {
            const transaction = db.transaction([LOGBOOK_DATASTORE], 'readwrite');
            transaction.oncomplete = () => {
              return resolve(workout);
            };
            transaction.onerror = err => {
              return reject(err);
            };
            const logbook = transaction.objectStore(LOGBOOK_DATASTORE);
            logbook.add(workout);
          });
        });
  }
}
