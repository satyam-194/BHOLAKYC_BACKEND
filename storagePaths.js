const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * All writes use absolute paths. No string "storage/images" or "./storage/..." in upload code.
 *
 * Production (pick one or both):
 *   • Set IMAGE_UPLOAD_BASE=/var/www/storage/images (and optionally STORAGE_ROOT_PATH=/var/www/storage)
 *   • Or symlink: ln -s /var/www/storage <backend>/storage  → see setup-storage-symlink.sh
 *
 * After a symlink exists, realpathSync() resolves STORAGE_ROOT/IMAGE_ROOT to /var/www/...
 */
function realpathIfExists(p) {
  try {
    return fs.existsSync(p) ? fs.realpathSync(p) : p;
  } catch {
    return p;
  }
}

const envStorage = process.env.STORAGE_ROOT_PATH?.trim();
const envImageBase = process.env.IMAGE_UPLOAD_BASE?.trim();

let STORAGE_ROOT;
let IMAGE_ROOT;

if (envImageBase) {
  IMAGE_ROOT = path.resolve(envImageBase);
  STORAGE_ROOT = envStorage
    ? path.resolve(envStorage)
    : path.resolve(path.join(IMAGE_ROOT, '..'));
} else if (envStorage) {
  STORAGE_ROOT = path.resolve(envStorage);
  IMAGE_ROOT = path.join(STORAGE_ROOT, 'images');
} else {
  STORAGE_ROOT = path.join(__dirname, 'storage');
  IMAGE_ROOT = path.join(STORAGE_ROOT, 'images');
}

STORAGE_ROOT = realpathIfExists(STORAGE_ROOT);
if (envImageBase) {
  IMAGE_ROOT = realpathIfExists(IMAGE_ROOT);
} else {
  IMAGE_ROOT = path.join(STORAGE_ROOT, 'images');
}

/** Canonical image upload root (e.g. /var/www/storage/images when storage is symlinked or env is set) */
const uploadBasePath = IMAGE_ROOT;

const VIDEO_ROOT = path.join(STORAGE_ROOT, 'videos');
const PDF_ROOT = path.join(STORAGE_ROOT, 'pdfs');
const MERGED_ROOT = path.join(STORAGE_ROOT, 'merged');

module.exports = {
  STORAGE_ROOT,
  IMAGE_ROOT,
  uploadBasePath,
  VIDEO_ROOT,
  PDF_ROOT,
  MERGED_ROOT,
};
