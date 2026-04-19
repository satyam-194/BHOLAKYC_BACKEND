const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const {
  drawPageHeader,
  drawPageFooter,
  HEADER_BOTTOM_Y,
  maxBodyY,
} = require('./pdfLetterhead');

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

      const maxContentY = maxBodyY(PAGE_H);

      // New pages use the same header band; body starts below letterhead.
      const addContentPage = () => {
        doc.addPage();
        doc.x = MARGIN;
        doc.y = HEADER_BOTTOM_Y;
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
        const body = safe(text);
        doc.fontSize(8).font('Helvetica-Bold');
        const hTitle = doc.heightOfString(title, { width: INNER });
        doc.font('Helvetica').fontSize(8);
        const hBody = doc.heightOfString(body, { width: INNER });
        const total =
          hTitle + doc.currentLineHeight() * 0.35 + hBody + doc.currentLineHeight() * 0.9;
        if (doc.y + total > maxContentY) addContentPage();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569')
          .text(title, MARGIN, doc.y, { width: INNER });
        doc.moveDown(0.35);
        doc.font('Helvetica').fontSize(8).fillColor('#334155')
          .text(body, MARGIN, doc.y, { width: INNER });
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
        doc.addPage();
        doc.x = MARGIN;
        doc.y = HEADER_BOTTOM_Y;

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

      // ── Letterhead: same header + footer on every page ───────────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        drawPageHeader(doc);
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
