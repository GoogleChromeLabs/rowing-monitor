import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(new URL('./mocks/resolve-hook.js', import.meta.url));
