const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * Absolute disk paths only — no "./storage/..." in app code.
 *
 * Production (typical):
 *   IMAGE_UPLOAD_BASE=/var/www/storage/images
 *   STORAGE_ROOT_PATH=/var/www/storage   (optional if same parent as images)
 *
 * If IMAGE_UPLOAD_BASE is set, STORAGE_ROOT defaults to the parent of that folder
 * so express.static(STORAGE_ROOT) still serves /storage/images/...
 */
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

/** Same as IMAGE_ROOT — use for multer image uploads */
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
