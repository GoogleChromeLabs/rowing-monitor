import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && (specifier.startsWith('./') || specifier.startsWith('../'))) {
      if (context.parentURL && context.parentURL.startsWith('file:')) {
        const parentDir = path.dirname(fileURLToPath(context.parentURL));
        const targetPath = path.resolve(parentDir, specifier);
        if (fs.existsSync(targetPath + '.js')) {
          return nextResolve(specifier + '.js', context);
        }
      }
    }
    throw err;
  }
}
