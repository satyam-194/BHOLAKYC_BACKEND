const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const COMPANY = {
  name: 'COINORA VDASP PRIVATE LIMITED',
  cin: 'U66190MH2025PTC451704',
  phone: '+91- 9136500665',
  email: 'akash93282@gmail.com',
  address:
    'Gala No. 20, Raviraj Industrial Estate, Bhayander East, Thane, Maharashtra, India, 401105'
};

const ROYAL_BLUE   = '#0047AB';
const HEADER_CORAL = '#FF5E5E';
const FOOTER_RED   = '#FF3131';

const TOP_BLUE_BAR_H  = 24;
const HEADER_BOTTOM_Y = 110; // content starts here on page 1 (below header + 20pt company name)
const FOOTER_BAR_H    = 20;
const FOOTER_H        = 118; // total height reserved for footer at page bottom

/** Header drawn only on page 1 — exact match to Letter Head_Coinora.pdf */
function drawFirstPageHeader(doc) {
  const pageW = doc.page.width;
  doc.save();

  // Full-width royal blue top bar
  doc.rect(0, 0, pageW, TOP_BLUE_BAR_H).fill(ROYAL_BLUE);

  // Coral triangle — wide at the top edge (~220pt), narrows diagonally to the
  // right edge at the bottom, matching the letterhead's top-right sweep shape.
  doc
    .path(
      `M ${pageW - 220} 0 ` +
      `L ${pageW} 0 ` +
      `L ${pageW} ${TOP_BLUE_BAR_H + 78} Z`
    )
    .fill(HEADER_CORAL);

  // Company name — 22px left margin (matches letterhead's near-edge placement)
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

/** Footer drawn on EVERY page — rule, CIN, phone+email, address, blue bar, red corner. */
function drawPageFooter(doc) {
  const pageW    = doc.page.width;
  const pageH    = doc.page.height;
  const footerTop = pageH - FOOTER_H;
  const marginX  = 30;
  const innerW   = pageW - marginX * 2;

  doc.save();

  // Rule line — near full-width matching letterhead
  doc.moveTo(marginX, footerTop).lineTo(pageW - marginX, footerTop)
    .strokeColor('#111827').lineWidth(0.7).stroke();

  let ty = footerTop + 10;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
    .text(`CIN : ${COMPANY.cin}`, marginX, ty, { width: innerW, align: 'center' });
  ty += 18;

  const phoneStr = COMPANY.phone;
  const emailStr = COMPANY.email;
  doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937');
  const phoneW  = doc.widthOfString(phoneStr);
  const gap     = 36;
  const iconPad = 20;
  const emailW  = doc.widthOfString(emailStr);
  const blockW  = iconPad + phoneW + gap + iconPad + emailW;
  const startX  = (pageW - blockW) / 2;

  drawPhoneIcon(doc, startX + 7.5, ty + 5);
  doc.text(phoneStr, startX + iconPad, ty, { lineBreak: false });
  const emailStart = startX + iconPad + phoneW + gap;
  drawMailIcon(doc, emailStart + 7.5, ty + 5);
  doc.text(emailStr, emailStart + iconPad, ty, { lineBreak: false });
  ty += 16;

  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1f2937')
    .text(COMPANY.address, marginX, ty, { width: innerW, align: 'center', lineGap: 2 });

  doc.rect(0, pageH - FOOTER_BAR_H, pageW, FOOTER_BAR_H).fill(ROYAL_BLUE);
  // Red corner triangle — 58pt tall × 72pt wide, matches letterhead exactly
  doc.path(`M 0 ${pageH - 70} L 84 ${pageH} L 0 ${pageH} Z`).fill(FOOTER_RED);

  doc.restore();
}

function safe(v) {
  if (v === undefined || v === null) return '';
  return String(v).trim() || '—';
}

function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return String(d);
  }
}

function isUsableImageFile(p) {
  if (!p || !String(p).trim()) return false;
  try {
    const st = fs.statSync(p);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

const generateKycPDF = (user) => {
  return new Promise((resolve, reject) => {
    try {
      const pdfDir  = path.join(__dirname, 'storage', 'pdfs');
      const pdfPath = path.join(pdfDir, `${user.refId}.pdf`);
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      const doc    = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const MARGIN = 50;
      const INNER  = PAGE_W - MARGIN * 2;

      const C = {
        navy:   '#0f172a',
        blue:   '#2563eb',
        blueBg: '#eff6ff',
        border: '#e2e8f0',
        gray:   '#64748b',
        label:  '#64748b',
        value:  '#1e293b'
      };

      // Bottom boundary content must not cross (reserves footer space on every page)
      const maxContentY = PAGE_H - FOOTER_H - 20;

      // Called when the main-content section overflows to a new page.
      // Non-first pages have no header so content starts at MARGIN.
      const addContentPage = () => {
        doc.addPage();
        doc.x = MARGIN;
        doc.y = MARGIN;
      };

      // ── Helper renderers ──────────────────────────────────────────────────────

      const sectionTitle = (title) => {
        if (doc.y > maxContentY - 40) addContentPage();
        doc.rect(MARGIN, doc.y, INNER, 24).fill(C.blueBg);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(C.blue)
          .text(title, MARGIN + 10, doc.y + 7, { width: INNER - 20 });
        doc.moveDown(2.1);
      };

      const infoRow = (label, value) => {
        if (doc.y > maxContentY - 22) addContentPage();
        const rowY = doc.y;
        const colW = INNER / 2 - 8;
        doc.fontSize(8).font('Helvetica').fillColor(C.label)
          .text(label.toUpperCase(), MARGIN, rowY, { width: colW });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(C.value)
          .text(safe(value), MARGIN + colW + 16, rowY, { width: colW });
        doc.moveTo(MARGIN, rowY + 16).lineTo(MARGIN + INNER, rowY + 16)
          .strokeColor(C.border).lineWidth(0.4).stroke();
        doc.moveDown(1.15);
      };

      const paraBlock = (title, text) => {
        if (doc.y > maxContentY - 50) addContentPage();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569')
          .text(title, MARGIN, doc.y, { width: INNER });
        doc.moveDown(0.35);
        doc.font('Helvetica').fontSize(8).fillColor('#334155')
          .text(safe(text), MARGIN, doc.y, { width: INNER });
        doc.moveDown(0.9);
      };


      // ── PAGE 1 — main KYC data ────────────────────────────────────────────────
      doc.x = MARGIN;
      doc.y = HEADER_BOTTOM_Y; // start below header on page 1

      // KYC title + subtitle
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C.navy)
        .text('Know Your Customer (KYC)', MARGIN, doc.y, { width: INNER, align: 'center' });
      doc.moveDown(0.35);
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text('Consolidated application record (confidential)', MARGIN, doc.y, { width: INNER, align: 'center' });
      doc.moveDown(0.6);

      // Reference ID badge
      const refBoxY = doc.y;
      const badgeW  = 200;
      const badgeX  = (PAGE_W - badgeW) / 2;
      doc.roundedRect(badgeX, refBoxY, badgeW, 22, 8).fill(C.blueBg);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(C.blue)
        .text(`Reference: ${safe(user.refId)}`, badgeX, refBoxY + 6, { width: badgeW, align: 'center' });
      doc.y = refBoxY + 32;

      // Applicant
      sectionTitle('Applicant & Session');
      infoRow('Full name',            user.buyer_full_name);
      infoRow('Mobile',               user.buyer_mobile);
      infoRow('Email',                user.buyer_email);
      infoRow('Submitted / recorded', fmtDate(user.execution_date));

      // Phase 1
      sectionTitle('Phase 1 — Declaration & Purpose');
      infoRow('Declared amount (INR)',    user.amount);
      infoRow('UTR / payment reference', user.utr_reference_no);
      infoRow('Purpose (Q5)',            user.q5);
      infoRow('Proof status',            user.proof_status);
      paraBlock('Q1 — Funds are your own (Yes/No)', user.q1);
      paraBlock('Q2 — Declaration',                 user.q2);
      paraBlock('Q3 — Profession',                  user.q3);
      paraBlock('Q4 — Acknowledgement',             user.q4);

      // Phase 2
      sectionTitle('Phase 2 — Identity Numbers');
      infoRow('Aadhaar (as provided)', user.buyer_aadhaar_no);
      infoRow('PAN',                   user.buyer_pan_no);


      // ── ANNEX PAGES — one image per page, no blank pages ─────────────────────
      // Purpose proof is excluded from annex images per requirements.
      const annexSlots = [
        ['Aadhaar — Front', user.path_aadhaar_front],
        ['Aadhaar — Back',  user.path_aadhaar_back],
        ['PAN Card',        user.path_pan_card],
        ['Live Selfie',     user.path_selfie_live]
      ].filter(([, p]) => isUsableImageFile(p));

      for (const [title, imgPath] of annexSlots) {
        // Each annex always starts on its own fresh page
        doc.addPage();
        doc.x = MARGIN;
        doc.y = MARGIN;

        // Section strip
        const stripY = doc.y;
        doc.rect(MARGIN, stripY, INNER, 28).fill(C.blueBg);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(C.blue)
          .text(title, MARGIN + 12, stripY + 8, { width: INNER - 24 });
        doc.y = stripY + 28 + 14; // advance past strip + gap

        // Image fills the remaining space above the footer
        const imgTop  = doc.y;
        const imgMaxH = maxContentY - imgTop;
        if (imgMaxH > 40) {
          try {
            doc.image(imgPath, MARGIN, imgTop, {
              fit:    [INNER, imgMaxH],
              align:  'center',
              valign: 'top'
            });
          } catch {
            doc.fontSize(10).font('Helvetica').fillColor(C.gray)
              .text('[Image could not be embedded]', MARGIN, imgTop + 40, { width: INNER, align: 'center' });
          }
        }
      }

      // ── Apply header (page 1 only) + footer (every page) ─────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        if (i === range.start) drawFirstPageHeader(doc);
        drawPageFooter(doc);
      }

      doc.end();
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = generateKycPDF;
