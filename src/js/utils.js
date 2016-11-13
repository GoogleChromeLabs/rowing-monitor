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

const LOCALE = 'en-US';

export function formatTime(date) {
  const hours = date.getHours().toLocaleString(LOCALE, {minimumIntegerDigits: 2});
  const minutes = date.getMinutes().toLocaleString(LOCALE, {minimumIntegerDigits: 2});
  const seconds = date.getSeconds().toLocaleString(LOCALE, {minimumIntegerDigits: 2});
  return hours + ':' + minutes + ':' + seconds;
}

export function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const hours = date.getHours().toLocaleString(LOCALE, {minimumIntegerDigits: 2});
  const minutes = date.getMinutes().toLocaleString(LOCALE, {minimumIntegerDigits: 2});
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
}
