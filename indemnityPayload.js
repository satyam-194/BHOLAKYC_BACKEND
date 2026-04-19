/**
 * Shared indemnity bond field metadata (admin form) and sanitization.
 * Keys must match generateIndemnityPDF.js `data` usage.
 */

const MAX_LEN = 600;

/** @type {{ title: string, fields: { key: string, label: string, placeholder?: string }[] }[]} */
const INDEMNITY_FIELD_GROUPS = [
  {
    title: 'Internal',
    fields: [
      { key: 'memo', label: 'Label / note (not printed on PDF)', placeholder: 'e.g. Draft for client X' }
    ]
  },
  {
    title: 'Execution date (§01)',
    fields: [
      { key: 'executionDay', label: 'Day', placeholder: 'e.g. 19' },
      { key: 'executionMonth', label: 'Month', placeholder: 'e.g. April' },
      { key: 'executionYear', label: 'Year', placeholder: 'e.g. 2026' }
    ]
  },
  {
    title: 'Indemnity holder (seller)',
    fields: [
      { key: 'holderName', label: 'Full name' },
      { key: 'holderFatherName', label: "Father's name" },
      { key: 'holderAadhaar', label: 'Aadhaar' },
      { key: 'holderPAN', label: 'PAN' },
      { key: 'holderAddress', label: 'Address' },
      { key: 'holderUID', label: 'KuCoin UID' }
    ]
  },
  {
    title: 'Indemnifier (buyer)',
    fields: [
      { key: 'indemnifierName', label: 'Full name' },
      { key: 'indemnifierFatherName', label: "Father's / mother's name" },
      { key: 'indemnifierAadhaar', label: 'Aadhaar' },
      { key: 'indemnifierPAN', label: 'PAN' },
      { key: 'indemnifierAddress', label: 'Address' },
      { key: 'indemnifierMobile', label: 'Mobile' },
      { key: 'buyerEmail', label: 'Email' }
    ]
  },
  {
    title: 'E-stamp',
    fields: [
      { key: 'receiptNumber', label: 'Receipt number' },
      { key: 'receiptDate', label: 'Receipt date' },
      { key: 'receiptAmount', label: 'Receipt amount (₹)' },
      { key: 'amountInWords', label: 'Amount in words' },
      { key: 'districtName', label: 'District' },
      { key: 'stampDutyPaidBy', label: 'Stamp duty paid by' },
      { key: 'grnNumber', label: 'GRN number' }
    ]
  },
  {
    title: 'TDS / VDA',
    fields: [
      { key: 'vdaType', label: 'Nature of VDA', placeholder: 'USDT' },
      { key: 'vdaQuantity', label: 'VDA quantity (summary)' },
      { key: 'tdsRate', label: 'TDS rate %' },
      { key: 'tdsAmount', label: 'TDS amount (USDT)' },
      { key: 'netVdaQuantity', label: 'Net VDA after TDS' },
      { key: 'vdaAssetName', label: 'VDA asset name' },
      { key: 'vdaQuantityExact', label: 'VDA quantity (exact units)' }
    ]
  },
  {
    title: 'Transaction',
    fields: [
      { key: 'transactionDate', label: 'Transaction date' },
      { key: 'transactionTime', label: 'Transaction time (IST)' },
      { key: 'inrAmountPaid', label: 'INR amount paid' },
      { key: 'utrNumber', label: 'UTR / reference' },
      { key: 'orderId', label: 'KuCoin P2P order ID' }
    ]
  },
  {
    title: 'Compliance answers (certificate)',
    fields: [
      { key: 'q1', label: 'Q1: Funds personal?' },
      { key: 'q2', label: 'Q2: Legal source?' },
      { key: 'q3', label: 'Q3: Profession' },
      { key: 'q4', label: 'Q4: Refund agreement' },
      { key: 'q5', label: 'Q5: Purpose of buying' }
    ]
  }
];

const PDF_KEYS = [
  'executionDay', 'executionMonth', 'executionYear',
  'holderName', 'holderFatherName', 'holderAadhaar', 'holderPAN', 'holderAddress', 'holderUID',
  'indemnifierName', 'indemnifierFatherName', 'indemnifierAadhaar', 'indemnifierPAN',
  'indemnifierAddress', 'indemnifierMobile', 'buyerEmail',
  'receiptNumber', 'receiptDate', 'receiptAmount', 'amountInWords', 'districtName',
  'stampDutyPaidBy', 'grnNumber',
  'vdaType', 'vdaQuantity', 'tdsRate', 'tdsAmount', 'netVdaQuantity',
  'vdaAssetName', 'vdaQuantityExact',
  'transactionDate', 'transactionTime', 'inrAmountPaid', 'utrNumber', 'orderId',
  'q1', 'q2', 'q3', 'q4', 'q5'
];

function sanitizeStr(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, MAX_LEN);
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ memo: string, payload: Record<string, string> }}
 */
function sanitizeAdminIndemnityBody(body) {
  const memo = sanitizeStr(body?.memo);
  const payload = {};
  for (const key of PDF_KEYS) {
    payload[key] = sanitizeStr(body?.[key]);
  }
  return { memo, payload };
}

/**
 * Fill blank seller / e-stamp / VDA fields from env (KYC auto-generation path).
 * @param {Record<string, string>} p
 */
function mergeIndemnityEnvDefaults(p) {
  const out = { ...p };
  const fill = (key, envKey, def = '') => {
    const cur = out[key];
    if (cur !== undefined && cur !== null && String(cur).trim() !== '') return;
    const ev = process.env[envKey];
    out[key] = ev != null && String(ev).trim() !== '' ? String(ev).trim() : def;
  };
  fill('holderName', 'INDEMNITY_HOLDER_NAME');
  fill('holderFatherName', 'INDEMNITY_HOLDER_FATHER_NAME');
  fill('holderAadhaar', 'INDEMNITY_HOLDER_AADHAAR');
  fill('holderPAN', 'INDEMNITY_HOLDER_PAN');
  fill('holderAddress', 'INDEMNITY_HOLDER_ADDRESS');
  fill('holderUID', 'INDEMNITY_HOLDER_KUCOIN_UID');
  fill('indemnifierFatherName', 'INDEMNITY_INDEMNIFIER_FATHER_NAME');
  fill('receiptNumber', 'INDEMNITY_ESTAMP_RECEIPT_NO');
  fill('receiptDate', 'INDEMNITY_ESTAMP_RECEIPT_DATE');
  fill('receiptAmount', 'INDEMNITY_ESTAMP_AMOUNT');
  fill('amountInWords', 'INDEMNITY_ESTAMP_AMOUNT_WORDS');
  fill('districtName', 'INDEMNITY_ESTAMP_DISTRICT');
  fill('stampDutyPaidBy', 'INDEMNITY_ESTAMP_PAID_BY');
  fill('grnNumber', 'INDEMNITY_ESTAMP_GRN');
  fill('vdaQuantity', 'INDEMNITY_VDA_QUANTITY');
  fill('tdsRate', 'INDEMNITY_TDS_RATE');
  fill('tdsAmount', 'INDEMNITY_TDS_AMOUNT');
  fill('netVdaQuantity', 'INDEMNITY_NET_VDA_QTY');
  fill('transactionDate', 'INDEMNITY_TRANSACTION_DATE');
  fill('transactionTime', 'INDEMNITY_TRANSACTION_TIME');
  fill('vdaAssetName', 'INDEMNITY_VDA_ASSET');
  fill('vdaQuantityExact', 'INDEMNITY_VDA_QTY_EXACT');
  fill('orderId', 'INDEMNITY_ORDER_ID');
  fill('vdaAssetName', 'INDEMNITY_VDA_ASSET');
  if (!String(out.vdaType || '').trim()) {
    out.vdaType = process.env.INDEMNITY_VDA_TYPE && String(process.env.INDEMNITY_VDA_TYPE).trim()
      ? String(process.env.INDEMNITY_VDA_TYPE).trim()
      : 'USDT';
  }
  if (!String(out.vdaAssetName || '').trim()) out.vdaAssetName = 'USDT';
  return out;
}

module.exports = {
  INDEMNITY_FIELD_GROUPS,
  PDF_KEYS,
  sanitizeAdminIndemnityBody,
  mergeIndemnityEnvDefaults
};
