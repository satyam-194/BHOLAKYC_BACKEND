/**
 * Shared Coinora letterhead: same header + footer on every page (KYC PDF, Indemnity Bond, etc.)
 */

const COMPANY = {
  name: 'COINORA VDASP PRIVATE LIMITED',
  cin: 'U66190MH2025PTC451704',
  phone: '+91- 9136500665',
  email: 'akash93282@gmail.com',
  /** NBSP before pincode so it never splits as "401" / "105" across lines */
  address:
    'Gala No. 20, Raviraj Industrial Estate, Bhayander East, Thane, Maharashtra, India,\u00A0401105'
};

const ROYAL_BLUE = '#0047AB';
const HEADER_CORAL = '#FF5E5E';
const FOOTER_RED = '#FF3131';

const TOP_BLUE_BAR_H = 24;
/** Y position where body content should begin (below header artwork + company name). */
const HEADER_BOTTOM_Y = 110;
const FOOTER_BAR_H = 20;
/** Total height reserved for footer block at bottom of page. */
const FOOTER_H = 118;

/** Extra gap between last body line and footer rule (used by PDF generators). */
const CONTENT_BOTTOM_PAD = 36;

/** Max `doc.y` allowed before starting a new block (body must stay above footer). */
function maxBodyY(pageH) {
  return pageH - FOOTER_H - CONTENT_BOTTOM_PAD;
}

function drawPhoneIcon(doc, cx, cy) {
  doc.save();
  doc.circle(cx, cy, 7.5).fill('#111827');
  doc.strokeColor('#ffffff').lineWidth(1.1);
  doc.moveTo(cx - 2.5, cy - 3).quadraticCurveTo(cx + 3, cy - 1, cx + 2, cy + 4).stroke();
  doc.restore();
}

function drawMailIcon(doc, cx, cy) {
  doc.save();
  doc.circle(cx, cy, 7.5).fill('#111827');
  doc.strokeColor('#ffffff').lineWidth(0.9);
  doc.moveTo(cx - 4, cy).lineTo(cx + 4, cy - 2).lineTo(cx + 4, cy + 2).lineTo(cx - 4, cy + 2).closePath().stroke();
  doc.moveTo(cx - 4, cy - 2).lineTo(cx + 4, cy).stroke();
  doc.restore();
}

/** Same header on every page — matches Letter Head_Coinora.pdf */
function drawPageHeader(doc) {
  const pageW = doc.page.width;
  doc.save();

  doc.rect(0, 0, pageW, TOP_BLUE_BAR_H).fill(ROYAL_BLUE);

  doc
    .path(
      `M ${pageW - 220} 0 ` +
      `L ${pageW} 0 ` +
      `L ${pageW} ${TOP_BLUE_BAR_H + 78} Z`
    )
    .fill(HEADER_CORAL);

  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .fillColor('#000000')
    .text(COMPANY.name, 22, TOP_BLUE_BAR_H + 12, {
      width: pageW - 22 - 240,
      align: 'left'
    });

  doc.restore();
}

/** Footer on every page — rule, CIN, phone+email, address, blue bar, red corner. */
function drawPageFooter(doc) {
  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const footerTop = pageH - FOOTER_H;
  const marginX = 30;
  const innerW = pageW - marginX * 2;

  doc.save();

  // Hide any body text that bled into the footer band (buffered pages draw footer last).
  doc.rect(0, footerTop, pageW, pageH - footerTop).fill('#ffffff');

  doc.moveTo(marginX, footerTop).lineTo(pageW - marginX, footerTop)
    .strokeColor('#111827').lineWidth(0.7).stroke();

  let ty = footerTop + 8;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
    .text(`CIN : ${COMPANY.cin}`, marginX, ty, { width: innerW, align: 'center' });
  ty += 17;

  const phoneStr = COMPANY.phone;
  const emailStr = COMPANY.email;
  doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937');
  const phoneW = doc.widthOfString(phoneStr);
  const gap = 40;
  const iconR = 7.5;
  const iconPad = iconR * 2 + 4;
  const emailW = doc.widthOfString(emailStr);
  const blockW = iconPad + phoneW + gap + iconPad + emailW;
  const startX = (pageW - blockW) / 2;

  const rowBaseline = ty;
  const iconCy = rowBaseline + 5;
  drawPhoneIcon(doc, startX + 7.5, iconCy);
  doc.text(phoneStr, startX + iconPad, rowBaseline, { lineBreak: false });
  const emailStart = startX + iconPad + phoneW + gap;
  drawMailIcon(doc, emailStart + 7.5, iconCy);
  doc.text(emailStr, emailStart + iconPad, rowBaseline, { lineBreak: false });
  ty = rowBaseline + 16;

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1f2937')
    .text(COMPANY.address, marginX, ty, {
      width: innerW,
      align: 'center',
      lineGap: 3,
    });

  doc.rect(0, pageH - FOOTER_BAR_H, pageW, FOOTER_BAR_H).fill(ROYAL_BLUE);
  doc.path(`M 0 ${pageH - 70} L 84 ${pageH} L 0 ${pageH} Z`).fill(FOOTER_RED);

  doc.restore();
}

module.exports = {
  COMPANY,
  drawPageHeader,
  drawPageFooter,
  HEADER_BOTTOM_Y,
  FOOTER_H,
  CONTENT_BOTTOM_PAD,
  maxBodyY,
  TOP_BLUE_BAR_H,
};
