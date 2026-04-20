const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * Disk root for uploads (images, videos, PDFs, merged). On the server set e.g.
 * STORAGE_ROOT_PATH=/var/www/storage so image files are stored under
 * /var/www/storage/images/<refId>/...
 * URLs stay /storage/images/... via express.static(STORAGE_ROOT).
 */
const STORAGE_ROOT = process.env.STORAGE_ROOT_PATH?.trim()
  ? path.resolve(process.env.STORAGE_ROOT_PATH.trim())
  : path.join(__dirname, 'storage');

const IMAGE_ROOT = path.join(STORAGE_ROOT, 'images');
const VIDEO_ROOT = path.join(STORAGE_ROOT, 'videos');
const PDF_ROOT = path.join(STORAGE_ROOT, 'pdfs');
const MERGED_ROOT = path.join(STORAGE_ROOT, 'merged');

module.exports = {
  STORAGE_ROOT,
  IMAGE_ROOT,
  VIDEO_ROOT,
  PDF_ROOT,
  MERGED_ROOT,
};
