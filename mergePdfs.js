const { PDFDocument } = require('pdf-lib');

/**
 * @param {Buffer[]} buffersInOrder - PDF file buffers; pages are appended in this order.
 * @returns {Promise<Uint8Array>}
 */
async function mergePdfBuffers(buffersInOrder) {
  const merged = await PDFDocument.create();
  for (const buf of buffersInOrder) {
    const src = await PDFDocument.load(buf);
    const copied = await merged.copyPages(src, src.getPageIndices());
    copied.forEach((page) => merged.addPage(page));
  }
  return merged.save();
}

module.exports = { mergePdfBuffers };
