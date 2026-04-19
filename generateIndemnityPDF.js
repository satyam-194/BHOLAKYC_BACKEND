const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const {
  drawPageHeader,
  drawPageFooter,
  HEADER_BOTTOM_Y,
  maxBodyY,
} = require('./pdfLetterhead');

const safe = (v) => (v === undefined || v === null || String(v).trim() === '') ? '—' : String(v).trim();

const generateIndemnityPDF = (data, bondId) => {
  return new Promise((resolve, reject) => {
    try {
      const pdfDir = path.join(__dirname, 'storage', 'indemnity_pdfs');
      const pdfPath = path.join(pdfDir, `${bondId}.pdf`);
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);

      const PAGE_W = doc.page.width;
      const PAGE_H = doc.page.height;
      const M = 50;
      const W = PAGE_W - M * 2;
      const maxY = maxBodyY(PAGE_H);
      const BLK = '#111827';
      const GRAY_NUM = '#9ca3af';
      /** Body paragraphs and filled fields: Helvetica regular. Bold reserved for main/section titles only. */
      const BODY_LINE_GAP = 2;

      const addPage = () => {
        doc.addPage();
        doc.x = M;
        doc.y = HEADER_BOTTOM_Y;
      };

      const tailAfterBlock = (gapLines) => doc.currentLineHeight() * gapLines;

      // Section header: gray bold number + bold title + rule; body text uses `para` / `inline` (regular).
      const sectionHeader = (num, title) => {
        doc.fontSize(12).font('Helvetica-Bold');
        const hTitle = doc.heightOfString(title, { width: W - 38 });
        doc.fontSize(10).font('Helvetica-Bold');
        const hNum = doc.heightOfString(num, { width: 30, align: 'right' });
        const blockH = Math.max(hNum, hTitle) + 18;
        if (doc.y + blockH > maxY) addPage();
        const y = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(GRAY_NUM)
          .text(num, M, y, { width: 30, align: 'right' });
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BLK)
          .text(title, M + 38, y, { width: W - 38 });
        const ruleY = doc.y + 2;
        doc.moveTo(M + 38, ruleY).lineTo(M + W, ruleY)
          .strokeColor(BLK).lineWidth(1.5).stroke();
        doc.y = ruleY + 10;
      };

      const para = (text, gap = 0.7) => {
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(text, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        doc.fillColor(BLK)
          .text(text, M, doc.y, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        doc.moveDown(gap);
      };

      const bullet = (text, gap = 0.35) => {
        const line = `\u2022 ${text}`;
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(line, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        doc.fillColor(BLK)
          .text(line, M, doc.y, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        doc.moveDown(gap);
      };

      const bulletInline = (segments, gap = 0.35) => {
        const parts = [{ text: '\u2022 ', dyn: false }, ...segments];
        const plain = parts.map((s) => s.text).join('');
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(plain, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        const startY = doc.y;
        for (let i = 0; i < parts.length; i++) {
          const seg = parts[i];
          const last = i === parts.length - 1;
          doc.font('Helvetica').fillColor(BLK);
          const opts = { width: W, align: 'justify', lineGap: BODY_LINE_GAP, continued: !last };
          if (i === 0) doc.text(seg.text, M, startY, opts);
          else doc.text(seg.text, opts);
        }
        doc.fillColor(BLK);
        doc.moveDown(gap);
      };

      const star = (text, gap = 0.35) => {
        const line = `* ${text}`;
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(line, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        doc.fillColor(BLK)
          .text(line, M, doc.y, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        doc.moveDown(gap);
      };

      const dash = (text, gap = 0.3) => {
        const line = `\u2013 ${text}`;
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(line, { width: W - 10, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        doc.fillColor(BLK)
          .text(line, M + 10, doc.y, { width: W - 10, align: 'justify', lineGap: BODY_LINE_GAP });
        doc.moveDown(gap);
      };

      const inline = (segments, gap = 0.7) => {
        const plain = segments.map((s) => s.text).join('');
        doc.fontSize(11).font('Helvetica');
        const h = doc.heightOfString(plain, { width: W, align: 'justify', lineGap: BODY_LINE_GAP });
        if (doc.y + h + tailAfterBlock(gap) > maxY) addPage();
        const startY = doc.y;
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const last = i === segments.length - 1;
          doc.font('Helvetica').fillColor(BLK);
          const opts = { width: W, align: 'justify', lineGap: BODY_LINE_GAP, continued: !last };
          if (i === 0) doc.text(seg.text, M, startY, opts);
          else doc.text(seg.text, opts);
        }
        doc.fillColor(BLK);
        doc.moveDown(gap);
      };

      const subHead = (text) => {
        doc.fontSize(11).font('Helvetica-Bold');
        const h = doc.heightOfString(text, { width: W });
        if (doc.y + h + tailAfterBlock(0.25) > maxY) addPage();
        doc.fillColor(BLK)
          .text(text, M, doc.y, { width: W });
        doc.moveDown(0.25);
      };

      // Body is laid out below the letterhead band; header/footer drawn after buffering.
      doc.x = M;
      doc.y = HEADER_BOTTOM_Y;

      doc.fontSize(24).font('Helvetica-Bold').fillColor(BLK)
        .text('INDEMNITY BOND', M, doc.y, { width: W, align: 'center' });
      doc.moveDown(1.5);

      // ── 01 ──
      sectionHeader('01', 'INDEMNITY BOND');
      doc.moveDown(0.4);

      inline([
        { text: 'This Indemnity Bond is executed and deemed to be executed electronically on this ' },
        { text: safe(data.executionDay), dyn: true },
        { text: ' day of ' },
        { text: safe(data.executionMonth), dyn: true },
        { text: ', ' },
        { text: safe(data.executionYear), dyn: true },
        { text: ', by the Indemnifier through valid digital / electronic means, including but not limited to electronic signature, e-sign, Aadhaar-based e-sign, digital consent, or any other mode recognized under the Information Technology Act, 2000 and the rules made thereunder.' }
      ]);

      para('It is expressly agreed, admitted, and declared that this Indemnity Bond shall be deemed to have been executed, received, accepted, and acted upon at the place of business of the Indemnity Holder, and such place alone shall be treated as the place of execution, irrespective of the physical location, residence, or geographical presence of the Indemnifier at the time of execution.');

      para('The Indemnifier irrevocably waives any right to dispute or challenge the mode, validity, timing, or place of execution of this Indemnity Bond on the ground of electronic signing, remote execution, absence of physical presence, or difference in territorial location of the parties.');

      // ── 02 ──
      doc.moveDown(0.5);
      sectionHeader('02', 'PARTIES INVOLVED');
      doc.moveDown(0.4);

      subHead('INDEMNITY HOLDER');
      inline([{ text: 'Mr. ' }, { text: safe(data.holderName), dyn: true }, { text: ',' }]);
      inline([{ text: 'Son of ' }, { text: safe(data.holderFatherName), dyn: true }]);
      para('an adult Indian citizen,');
      inline([
        { text: 'bearing Aadhaar Number ' },
        { text: safe(data.holderAadhaar), dyn: true },
        { text: ' and Permanent Account Number (PAN) ' },
        { text: safe(data.holderPAN), dyn: true },
        { text: ',' }
      ]);
      inline([{ text: 'presently residing at ' }, { text: safe(data.holderAddress), dyn: true }, { text: ',' }]);
      inline([{ text: 'and holding KuCoin User Identification Number (UID): ' }, { text: safe(data.holderUID), dyn: true }, { text: ',' }]);
      para('who is a Merchant duly registered and verified on KuCoin Exchange, which is registered with the Financial Intelligence Unit (FIU), Government of India, and who is lawfully engaged in the purchase, receipt, and dealing of Virtual Digital Assets (VDA) in accordance with applicable laws, rules, regulations, notifications, and guidelines in force in India,');
      para('hereinafter referred to as the \u201cINDEMNITY HOLDER\u201d,');
      para('(which expression shall, unless repugnant to the context or meaning thereof, be deemed to include his heirs, legal representatives, executors, administrators, successors-in-interest, and assigns).');

      doc.moveDown(0.5);
      subHead('INDEMNIFIER');
      inline([{ text: 'Mr./Ms. ' }, { text: safe(data.indemnifierName), dyn: true }, { text: ',' }]);
      inline([{ text: 'Son/Daughter of ' }, { text: safe(data.indemnifierFatherName), dyn: true }, { text: ',' }]);
      para('an adult individual competent to contract under the Indian Contract Act, 1872,');
      inline([
        { text: 'bearing Aadhaar Number ' },
        { text: safe(data.indemnifierAadhaar), dyn: true },
        { text: ' and Permanent Account Number (PAN) ' },
        { text: safe(data.indemnifierPAN), dyn: true },
        { text: ' ,' }
      ]);
      inline([{ text: 'presently residing at ' }, { text: safe(data.indemnifierAddress), dyn: true }, { text: ',' }]);
      inline([{ text: 'Mobile Number: ' }, { text: safe(data.indemnifierMobile), dyn: true }, { text: ',' }]);
      para('who has voluntarily, knowingly, and without any coercion, undue influence, or misrepresentation furnished his/her personal, identification, and address particulars, and who shall, whenever so required, provide any additional identification documents, declarations, confirmations, or information as may be demanded by the Indemnity Holder or any competent authority,');
      para('hereinafter referred to as the \u201cINDEMNIFIER\u201d,');
      para('(which expression shall, unless repugnant to the context or meaning thereof, be deemed to include his/her heirs, legal representatives, executors, administrators, successors-in-interest, legal assigns, and estate).');

      // ── 03 ──
      doc.moveDown(0.5);
      sectionHeader('03', 'NON-CHALLENGE OF PARTY ROLES, PLATFORM ACKNOWLEDGEMENT & CONCLUSIVE ADMISSION');
      doc.moveDown(0.4);
      para('The Indemnifier expressly, irrevocably, and unconditionally admits, acknowledges, and agrees that for the purposes of this transaction:');
      bullet('the Indemnifier is the Buyer, who has voluntarily purchased / acquired Virtual Digital Assets (VDA) through the KuCoin Exchange \u2013 P2P mechanism; and');
      bulletInline([
        { text: 'the Seller / Indemnity Holder is ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ', acting solely in the capacity of Seller on KuCoin P2P.', dyn: false },
      ]);
      para('The Indemnifier categorically agrees and undertakes that the Indemnifier shall never, at any time whatsoever, directly or indirectly, challenge, dispute, deny, recharacterize, or question:');
      bullet('the role, status, or capacity of the Indemnifier as Buyer;');
      bulletInline([
        { text: 'the role, status, or capacity of ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ' as Seller / Indemnity Holder;', dyn: false },
      ]);
      bullet('the nature of the transaction as a VDA sale / purchase executed through KuCoin P2P;');
      bullet('the platform-based execution, order flow, or designation of buyer and seller as reflected in KuCoin records, order ID, chat logs, transaction logs, or platform data.');
      para('The Indemnifier further irrevocably waives any right to allege or contend that:');
      bullet('the Seller was an intermediary, agent, broker, partner, or facilitator;');
      bullet('the transaction was misclassified or misunderstood;');
      bullet('the roles of Buyer and Seller were reversed, shared, or unclear;');
      bullet('the Indemnifier was acting on behalf of any third party.');

      // ── 04 ──
      doc.moveDown(0.5);
      sectionHeader('04', 'PLATFORM RECORDS AS FINAL EVIDENCE');
      doc.moveDown(0.4);
      para('The Indemnifier expressly agrees that KuCoin platform records, including but not limited to P2P order details, order ID, timestamps, buyer-seller designation, chat history, and transaction confirmations, shall be final, conclusive, and binding evidence of the respective roles and nature of the transaction, without requirement of further proof.');

      // ── 05 ──
      doc.moveDown(0.5);
      sectionHeader('05', 'ESTOPPEL & DEEMED ADMISSION');
      doc.moveDown(0.4);
      para('Any attempt by the Indemnifier to dispute or challenge the above acknowledgements shall be deemed a false plea, wilful misrepresentation, and material breach of this Indemnity Bond, and the Indemnifier shall be estopped in law from raising any such contention before any bank, court, tribunal, regulator, law-enforcement agency, or authority.');
      para('This clause shall be absolute, continuing, overriding, and perpetual, and shall survive completion of the transaction, closure of the KuCoin P2P order, or termination of this Indemnity Bond, without limitation of time.');

      // ── 06 ──
      doc.moveDown(0.5);
      sectionHeader('06', 'DEEMED BREACH & ABSOLUTE LIABILITY');
      doc.moveDown(0.4);
      para('Any falsity, inaccuracy, suppression, or subsequent adverse finding in relation to the source of funds shall constitute a material breach, and shall result in automatic, strict, and absolute liability of the Indemnifier, without requirement of proof, notice, or adjudication.');
      para('The Indemnifier hereby fully, absolutely, and irrevocably indemnifies and holds harmless the Seller / Indemnity Holder from all losses, penalties, claims, proceedings, investigations, summons, notices, bank freezes, debit restrictions, tax demands, regulatory actions, and legal consequences, whether civil or criminal, arising now or at any time in future, directly or indirectly, from the source, nature, or legality of the funds.');
      para('The Indemnifier expressly waives all defences, including lack of knowledge, subsequent discovery, bank error, third-party fault, passage of time, or change in law, and agrees that this clause shall survive perpetually, notwithstanding completion or closure of the transaction.');

      // ── 07 ──
      doc.moveDown(0.5);
      sectionHeader('07', 'E-STAMP ADMISSIBILITY ESTOPPEL');
      doc.moveDown(0.4);
      para('The Indemnifier and the Indemnity Holder jointly and severally admit, acknowledge, and confirm that the present Indemnity Bond is executed on validly generated electronic stamp paper (e-Stamp), and that the following e-Stamp particulars form an integral, inseparable, and binding part of this Indemnity Bond:');
      inline([{ text: '\u2022 Receipt Number: ' }, { text: safe(data.receiptNumber), dyn: true }]);
      inline([{ text: '\u2022 Receipt Date: ' }, { text: safe(data.receiptDate), dyn: true }]);
      inline([{ text: '\u2022 Receipt Amount (\u20b9): ' }, { text: safe(data.receiptAmount), dyn: true }]);
      inline([{ text: '\u2022 Amount in Words: ' }, { text: safe(data.amountInWords), dyn: true }]);
      para('\u2022 Document Type: Indemnity Bond');
      inline([{ text: '\u2022 District Name: ' }, { text: safe(data.districtName), dyn: true }]);
      inline([{ text: '\u2022 Stamp Duty Paid By: ' }, { text: safe(data.stampDutyPaidBy), dyn: true }]);
      para('\u2022 Purpose of Stamp Duty Paid: Execution of Indemnity Bond');
      bulletInline([
        { text: 'First Party Name: ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ' (Indemnity Holder / Seller)', dyn: false },
      ]);
      inline([{ text: '\u2022 Second Party Name: ' }, { text: safe(data.indemnifierName), dyn: true }, { text: '  (Indemnifier / Buyer)' }]);
      inline([{ text: '\u2022 GRN Number: ' }, { text: safe(data.grnNumber), dyn: true }]);
      para('The Indemnifier expressly admits and agrees that:');
      bulletInline([
        { text: 'the First Party is ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ', acting as Seller and Indemnity Holder;', dyn: false },
      ]);
      bullet('the Second Party is the Indemnifier, acting as Buyer;');
      bullet('the e-Stamp paper has been lawfully purchased, duly paid, and correctly utilized for execution of this Indemnity Bond.');

      // ── 08 ──
      doc.moveDown(0.5);
      sectionHeader('08', 'VALIDITY, ADMISSIBILITY & ESTOPPEL');
      doc.moveDown(0.4);
      para('The Indemnifier irrevocably waives any right to challenge, dispute, deny, or question:');
      bullet('the validity, sufficiency, authenticity, or adequacy of the e-Stamp paper;');
      bullet('the amount of stamp duty, mode of payment, or particulars filled therein;');
      bullet('the name, designation, or role of either party as reflected on the e-Stamp;');
      bullet('the electronic nature of the stamp paper or its admissibility as evidence.');
      para('The parties expressly agree that the said e-Stamp particulars shall be final, conclusive, and binding proof of due stamping and execution, and shall be admissible in evidence before any court, tribunal, authority, bank, or regulator, without requirement of further proof or certification.');
      para('Any attempt by the Indemnifier to dispute or invalidate this Indemnity Bond on the ground of stamp duty, e-Stamp details, clerical error, technicality, or form shall be deemed a false plea and wilful breach, and the Indemnifier shall be estopped in law from raising any such objection at any time.');
      para('This clause shall be absolute, overriding, continuing, and perpetual, and shall survive execution, digital signing, completion of transaction, or closure of order, without limitation of time.');

      // ── 09 ──
      doc.moveDown(0.5);
      sectionHeader('09', 'TAX DEDUCTED AT SOURCE (TDS) \u2013 VIRTUAL DIGITAL ASSET (VDA) TRANSACTIONS');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably, unequivocally, and expressly acknowledges, admits, and agrees that the present transaction involves the transfer of Virtual Digital Assets (VDA) and that Tax Deducted at Source (TDS) has been validly, lawfully, and mandatorily deducted in strict compliance with Section 194S of the Income Tax Act, 1961, read with all applicable rules, circulars, notifications, and guidelines issued thereunder.');
      subHead('Transaction & TDS Particulars');
      inline([{ text: 'a) Nature of VDA: ' }, { text: safe(data.vdaType), dyn: true }, { text: '  (Virtual Digital Asset)' }]);
      inline([{ text: 'b) Quantity of VDA Transferred / Released: ' }, { text: safe(data.vdaQuantity), dyn: true }, { text: ' USDT' }]);
      inline([{ text: 'c) Applicable TDS Rate under Section 194S: ' }, { text: safe(data.tdsRate), dyn: true }, { text: ' %' }]);
      inline([{ text: 'd) Amount of TDS Deducted: ' }, { text: safe(data.tdsAmount), dyn: true }, { text: ' USDT' }]);
      inline([{ text: 'e) Net VDA Quantity Released after TDS Deduction: ' }, { text: safe(data.netVdaQuantity), dyn: true }, { text: ' USDT' }]);
      doc.moveDown(0.4);
      para('The parties expressly acknowledge that TDS on VDA transactions is required to be deducted in the same Virtual Digital Asset (USDT) and not in fiat currency, and that such deduction has been accurately computed, validly deducted, and appropriately accounted for at the time of execution of the transaction.');

      // ── 10 ──
      doc.moveDown(0.5);
      sectionHeader('10', 'TRANSACTION PARTICULARS, PARTY IDENTIFICATION & COMPLETE DISCLOSURE');
      doc.moveDown(0.4);

      subHead('A. BUYER (INDEMNIFIER) DETAILS');
      para('The Buyer / Indemnifier hereby declares that the following particulars are true, correct, complete, and voluntarily disclosed, and shall be relied upon as conclusive identification:');
      inline([{ text: '\u2022 Indemnifier Full Name : ' }, { text: safe(data.indemnifierName), dyn: true }]);
      inline([{ text: "\u2022 Indemnifier Father\u2019s Full Name: " }, { text: safe(data.indemnifierFatherName), dyn: true }]);
      inline([{ text: '\u2022 Indemnifier Permanent Residential Address : ' }, { text: safe(data.indemnifierAddress), dyn: true }]);
      inline([{ text: '\u2022 Indemnifier Mobile Number : ' }, { text: safe(data.indemnifierMobile), dyn: true }]);
      inline([{ text: '\u2022 Indemnifier Government ID : ' }, { text: safe(data.indemnifierAadhaar), dyn: true }]);

      doc.moveDown(0.4);
      subHead('B. SELLER (INDEMNITY HOLDER) DETAILS');
      bulletInline([
        { text: 'Seller / Indemnity Holder Name: ', dyn: false },
        { text: safe(data.holderName), dyn: true },
      ]);
      bulletInline([
        { text: 'Father\u2019s Full Name: ', dyn: false },
        { text: safe(data.holderFatherName), dyn: true },
      ]);
      bulletInline([
        { text: 'Full Residential / Business Address: ', dyn: false },
        { text: safe(data.holderAddress), dyn: true },
      ]);

      doc.moveDown(0.4);
      subHead('C. TRANSACTION & VDA DETAILS');
      para('The Buyer / Indemnifier confirms that the below transaction details are accurately stated and acknowledged without dispute:');
      inline([{ text: '\u2022 Date of Transaction: ' }, { text: safe(data.transactionDate), dyn: true }]);
      inline([{ text: '\u2022 Exact Time of Transaction (IST): ' }, { text: safe(data.transactionTime), dyn: true }]);
      inline([{ text: '\u2022 VDA Asset Name: ' }, { text: safe(data.vdaAssetName), dyn: true }]);
      inline([{ text: '\u2022 VDA Quantity (Exact Units): ' }, { text: safe(data.vdaQuantityExact), dyn: true }]);
      inline([{ text: '\u2022 INR Amount Paid: \u20b9 ' }, { text: safe(data.inrAmountPaid), dyn: true }]);
      inline([{ text: '\u2022 UTR / Reference Number: ' }, { text: safe(data.utrNumber), dyn: true }]);
      inline([{ text: '\u2022 Order ID / Platform Reference (KuCoin P2P): ' }, { text: safe(data.orderId), dyn: true }]);

      // ── 11 ──
      doc.moveDown(0.5);
      sectionHeader('11', 'SOURCE OF FUNDS DECLARATION');
      doc.moveDown(0.4);
      para('The Indemnifier hereby solemnly, irrevocably, unconditionally, and perpetually declares, represents, warrants, covenants, and undertakes that all funds whatsoever (whether in INR or any other form) used in connection with the present transaction, including for the purchase, settlement, or consideration of Virtual Digital Assets (VDA), are self-owned, beneficially owned, lawfully acquired, clean, unencumbered, and fully compliant with all applicable laws of India.');
      para('The Indemnifier categorically affirms and admits that such funds:');
      bullet('do not, and shall not at any time, constitute \u201cProceeds of Crime\u201d as defined under the Prevention of Money Laundering Act, 2002 (PMLA) or any amendment thereto;');
      bullet('are not derived, sourced, layered, structured, routed, or generated, directly or indirectly, from any illegal, prohibited, or unlawful activity, including but not limited to fraud, cyber crime, phishing, hacking, impersonation, scam, terrorism financing, hawala, benami transactions, shell entities, accommodation entries, or tax evasion;');
      bullet('are not subject, whether presently or in future (including retrospectively), to any lien, charge, attachment, debit freeze, hold, investigation, inquiry, notice, or dispute by any bank, financial institution, regulatory authority, law-enforcement agency, or third party.');
      para('The Indemnifier further unconditionally declares and admits that:');
      bullet('the funds are not borrowed, not fronted, not pooled, not third-party owned, and are not received, held, or transferred on behalf of any other person or entity;');
      bullet('no impersonation, misrepresentation, suppression, concealment, or omission of material facts has been committed at any stage;');
      bullet('all KYC documents, bank account details, identity particulars, declarations, and confirmations provided are true, accurate, complete, and correct, and shall be deemed to be continuing representations.');
      para(`The Indemnifier expressly acknowledges and admits that the Seller / Indemnity Holder has entered into the transaction and executed this Indemnity Bond solely, exclusively, and unconditionally relying upon the truth, accuracy, and completeness of the above declarations, without any independent verification obligation.`);

      // ── 12 ──
      doc.moveDown(0.5);
      sectionHeader('12', 'PURPOSE / OBJECT OF INDEMNITY');
      doc.moveDown(0.4);
      para('This Indemnity Bond is executed by the INDEMNIFIER in favour of the INDEMNITY HOLDER, who is a Merchant engaged in the sale and release of Virtual Digital Assets (VDA) on the KuCoin Exchange through peer-to-peer (P2P) transactions, for the specific purpose of indemnifying, defending, and holding harmless the Indemnity Holder against any and all losses, liabilities, claims, actions, proceedings, restrictions, or adverse consequences arising out of or in connection with the funds transferred by the Indemnifier.');
      para('The Indemnifier has expressly represented, affirmed, and declared that the funds transferred or paid to the Indemnity Holder for the purchase of VDA are lawful, genuine, clean, and untainted funds, and that such funds:');
      bullet('do not constitute proceeds of crime;');
      bullet('are not derived from fraud, cheating, impersonation, cybercrime, or any illegal activity;');
      bullet('are not linked to money laundering, terrorism financing, or any offence under applicable laws;');
      bullet('are free from any lien, charge, attachment, investigation, or third-party claim.');
      para('Relying solely upon the aforesaid declarations, assurances, and representations of the Indemnifier, the Indemnity Holder releases the VDA, whereupon the VDA is irreversibly transferred to the counter-party and goes beyond the control, custody, or recall of the Indemnity Holder.');
      para('It is expressly agreed and acknowledged that if at any time, whether before or after the release of the VDA, it is discovered, alleged, or determined by any bank, financial institution, law enforcement agency, regulatory authority, or competent court that the funds received by the Indemnity Holder were fraudulent, tainted, suspicious, or constituted proceeds of crime, resulting in lien, debit freeze, hold, reversal, attachment, inquiry, notice, or restriction on the account of the Indemnity Holder, then the Indemnifier shall be solely and absolutely liable for the same.');
      para('In such an event, the Indemnifier hereby irrevocably undertakes and agrees to reimburse, refund, and compensate the Indemnity Holder an amount equivalent to the entire INR value so received, without demur, dispute, or delay, within forty-eight (48) hours from the time of demand, notice, or intimation by the Indemnity Holder.');
      para('Failure, refusal, or neglect on the part of the Indemnifier to make such payment within the stipulated 48-hour period shall automatically and without further notice trigger the dispute resolution and recovery mechanism as provided under this Indemnity Bond, and the Indemnity Holder shall be entitled to initiate recovery proceedings, including but not limited to.');

      // ── 13 ──
      doc.moveDown(0.5);
      sectionHeader('13', 'BANK HOLD / LIEN / DEBIT FREEZE \u2013 DEEMED CAUSATION & FULL COST RECOVERY');
      doc.moveDown(0.4);
      para("The Indemnifier hereby irrevocably, unconditionally, and absolutely agrees and undertakes that if any hold, lien, debit freeze, debit restriction, reversal request, chargeback, inquiry, investigation, or debit block is imposed on the Seller\u2019s / Indemnity Holder\u2019s bank account at any time whatsoever, arising out of, relating to, traceable to, or linked with the payment made by the Indemnifier, including by reason of the UTR number, transaction reference, source bank, intermediary bank, payment trail, narration, or originating account, then such event shall be conclusively deemed to have occurred solely due to the Indemnifier\u2019s payment, without requirement of further proof.");

      // ── 14 ──
      doc.moveDown(0.5);
      sectionHeader('14', 'DISPUTE RESOLUTION \u2013 MANDATORY ARBITRATION');
      doc.moveDown(0.4);
      para('Notwithstanding anything to the contrary contained herein, any dispute, controversy and / or claim arising out of and / or relating to this contract, including its construction, interpretation, meaning, scope, operation, effect and / or validity thereof (\u201cDispute\u201d), shall be resolved by arbitration, administered by Presolv360, an independent institution, in accordance with its Dispute Resolution Rules (\u201cRules\u201d).');
      doc.moveDown(0.3);
      para('The parties agree that the arbitration shall be before a sole arbitrator appointed under the Rules. The juridical seat of arbitration shall be India. The language of arbitration shall be English. The law governing the arbitration proceedings shall be Indian law. The decision of the arbitrator shall be final and binding on the parties. Subject to the above, the competent courts at the seat shall have exclusive jurisdiction.');
      doc.moveDown(0.3);
      para('The parties agree to carry out the arbitration proceedings virtually through the online dispute resolution (\u201cODR\u201d) platform of Presolv360 and, for such purpose, the email addresses and / or mobile numbers available, provided or otherwise referenced in the contract shall be considered. Each party shall be responsible for intimating such institution in the event of any change in its email address and / or mobile number throughout the arbitration proceedings.');
      doc.moveDown(0.3);
      para('In the event the arbitration proceedings cannot be administered virtually in the opinion of the arbitrator, the proceedings shall be conducted physically, and the venue of the proceedings shall be as determined by the arbitrator having regard to the circumstances of the case, including the convenience of the parties.');

      // ── 15 ──
      doc.moveDown(0.5);
      sectionHeader('15', 'DEEMED CAUSE \u2013 NO DISPUTE');
      doc.moveDown(0.4);
      para('The Indemnifier expressly agrees that the existence of a matching UTR / transaction reference alone shall constitute final and conclusive evidence of causation, and the Indemnifier shall be estopped from denying, disputing, or questioning such linkage on any ground whatsoever.');

      // ── 16 ──
      doc.moveDown(0.5);
      sectionHeader('16', 'MANDATORY REFUND UPON DISPUTE INVOCATION');
      doc.moveDown(0.4);
      para('Upon invocation or execution of the Dispute Resolution Mechanism, or upon demand by the Seller / Indemnity Holder, the Indemnifier shall be unconditionally bound to refund the entire disputed /hold/lien/ blocked amount:');
      doc.moveDown(0.3);
      star('within 48 (forty-eight) hours of written or electronic demand,');
      star('without waiting for completion or outcome of any bank inquiry, cyber-cell verification, police investigation, or regulatory proceeding,');
      star('without protest, demur, condition, set-off, or counter-claim.');

      // ── 17 ──
      doc.moveDown(0.5);
      sectionHeader('17', 'REFUSAL, FAILURE OR DELAY \u2013 STRICT CONSEQUENCES');
      doc.moveDown(0.4);
      para('In the event the Indemnifier fails, refuses, delays, or neglects to refund the amount within the stipulated time:');
      doc.moveDown(0.3);
      star('The Indemnifier shall be strictly, absolutely, and solely liable for all costs, expenses, and consequences incurred from the date of freeze until the date of full and final recovery, including but not limited to:');
      dash('bank charges, penalties, lien-related costs,');
      dash('legal fees, advocate fees, court fees, arbitration fees,');
      dash('costs before banks, courts, tribunals, cyber cells, police, regulators,');
      dash('documentation, affidavits, representations, travel, administrative and compliance costs,');
      dash('opportunity loss and business disruption costs.');
      doc.moveDown(0.3);
      star('Such liability shall accrue on a continuing and daily basis, without any monetary cap, until the Seller / Indemnity Holder receives the entire blocked amount in cleared funds, together with all incidental and consequential costs.');
      doc.moveDown(0.3);
      para('The Indemnifier irrevocably waives:');
      star('any right to seek stay, injunction, or restraint against recovery;');
      star('any defence based on pendency of investigation, bank delay, third-party fault, partial recovery, settlement discussions, or passage of time.');
      doc.moveDown(0.3);
      para('The Seller / Indemnity Holder shall be entitled to initiate and pursue civil, criminal, regulatory, banking, and recovery proceedings simultaneously and independently, at the sole cost, risk, and consequence of the Indemnifier.');
      doc.moveDown(0.3);
      subHead('SURVIVAL & OVERRIDING EFFECT');
      para('This clause shall be independent, overriding, continuing, and perpetual, and shall survive completion of the transaction, closure of order, termination of this Indemnity Bond, or any settlement, until full recovery of the principal amount and all associated costs is achieved.');

      // ── 18 ──
      doc.moveDown(0.5);
      sectionHeader('18', 'FORTY-EIGHT (48) HOUR ABSOLUTE, UNCONDITIONAL AND TIME-ESSENCE REIMBURSEMENT OBLIGATION');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably, unconditionally, and unequivocally undertakes, covenants, and agrees that upon the occurrence of any event giving rise to liability under this Bond, the Indemnifier shall forthwith, without delay, and as a matter of absolute obligation, pay, refund, reimburse, and fully compensate the Indemnity Holder an amount equivalent to the entire INR value received, together with all incidental, consequential, and ancillary losses, damages, costs, charges, and expenses (including legal, professional, and recovery costs), within a strict and non-extendable period of forty-eight (48) hours from the time of demand, notice, or intimation by the Indemnity Holder.');
      doc.moveDown(0.3);
      para('Time is hereby expressly declared to be of the essence of this obligation.');
      doc.moveDown(0.3);
      para('The Indemnifier expressly agrees and acknowledges that no objection, defence, explanation, clarification, inquiry, investigation, pendency of proceedings, dispute, negotiation, correspondence, or request for extension, of any nature whatsoever, shall operate to suspend, defer, postpone, qualify, condition, or in any manner dilute this reimbursement obligation.');
      doc.moveDown(0.3);
      para('Failure to comply within the stipulated 48-hour period shall constitute a material, wilful, and continuing breach of this Bond, entitling the Indemnity Holder to immediate enforcement, recovery, and invocation of dispute resolution mechanisms, without any further notice or opportunity to the Indemnifier.');

      // ── 19 ──
      doc.moveDown(0.5);
      sectionHeader('19', 'WAIVER OF DEFENCES, OBJECTIONS & PLEAS');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably, unconditionally, knowingly, and voluntarily waives, relinquishes, abandons, and forever forgoes any and all rights, claims, contentions, objections, defences, pleas, or grounds of challenge, whether present or future, known or unknown, foreseen or unforeseen, legal or equitable, that may otherwise be available under law, contract, equity, or practice, including but not limited to any plea based on:');
      bullet('a) ignorance or lack of knowledge of law, facts, source of funds, or consequences;');
      bullet('b) fault, act, omission, or negligence of any third party, intermediary, bank, platform, exchange, or counter-party;');
      bullet('c) error, delay, failure, omission, or action of any bank, payment system, financial institution, or service provider;');
      bullet('d) pendency, continuation, or outcome of any investigation, inquiry, audit, or proceeding;');
      bullet('e) absence of conviction, charge-sheet, prosecution, or final adjudication;');
      bullet('f) force majeure, hardship, impossibility, frustration, or change of circumstances;');
      bullet('g) technical defects, procedural irregularities, clerical errors, or formal deficiencies;');
      bullet('h) lack of jurisdiction, improper forum, venue, limitation, or territorial objection;');
      bullet('i) alleged good faith, absence of intent, lack of mens rea, or subsequent exoneration.');
      doc.moveDown(0.3);
      para('The Indemnifier expressly agrees that no such defence, objection, plea, or contention shall be raised, nor shall any of the same operate to delay, suspend, reduce, condition, qualify, mitigate, or extinguish the obligations or liabilities of the Indemnifier under this Bond.');
      doc.moveDown(0.3);
      para('This waiver is absolute, final, binding, and irrevocable, shall operate as a complete bar to all contrary pleas, and shall survive perpetually, notwithstanding any investigation, dispute, arbitration, court proceeding, settlement, closure, or passage of time.');

      // ── 20 ──
      doc.moveDown(0.5);
      sectionHeader('20', 'ABSOLUTE LIABILITY CLAUSE');
      doc.moveDown(0.4);
      para('It is expressly, unequivocally, and irrevocably agreed that the mere occurrence of any allegation, suspicion, alert, inquiry, notice, communication, action, restraint, or proceeding, whether oral or written, provisional or final, formal or informal, by any bank, payment system, financial institution, law enforcement agency, investigative authority, FIU-IND, tax authority, regulatory body, quasi-judicial authority, or court of competent or purported jurisdiction, to the effect that the funds transferred by the Indemnifier were tainted, suspicious, unlawful, fraudulent, or proceeds of crime, shall be sufficient in itself to immediately and automatically trigger liability under this Bond.');
      doc.moveDown(0.3);
      para('Such liability shall arise without the requirement of:');
      star('any conviction, charge-sheet, or prosecution;');
      star('any final adjudication or determination;');
      star('any finding of guilt, intent, negligence, or mens rea;');
      star('any proof beyond allegation, suspicion, or preliminary action.');
      doc.moveDown(0.3);
      para('Upon the occurrence of any such event, the Indemnifier shall be solely, strictly, absolutely, and unconditionally liable, on a strict-liability basis, for all consequences arising therefrom, irrespective of fault, intent, knowledge, participation, or foreseeability, and irrespective of whether such allegation, inquiry, or action is subsequently withdrawn, closed, stayed, quashed, or set aside.');
      doc.moveDown(0.3);
      para('The Indemnifier expressly agrees that no defence, including pendency of investigation, absence of final outcome, good faith, or subsequent exoneration, shall delay, suspend, mitigate, or extinguish the liability arising under this clause.');

      // ── 21 ──
      doc.moveDown(0.5);
      sectionHeader('21', 'INDEMNITY (AML / PMLA / FEMA / TAX / IT / REGULATORY)');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably, unconditionally, absolutely, and perpetually agrees, undertakes, and binds himself/herself to fully indemnify, defend, protect, and hold harmless the Indemnity Holder from and against any and all liabilities whatsoever, whether civil, criminal, regulatory, quasi-judicial, or administrative, arising directly or indirectly, in whole or in part, under or in connection with:');
      bullet('a) the Prevention of Money Laundering Act, 2002 (PMLA), including but not limited to attachment, seizure, confiscation, inquiry, investigation, prosecution, penalty, or proceedings by any authority thereunder;');
      bullet('b) the Foreign Exchange Management Act, 1999 (FEMA), including any contravention, inquiry, adjudication, penalty, compounding, or enforcement action;');
      bullet('c) the Income Tax Act, 1961, including proceedings relating to undisclosed income, unexplained credits, source of funds, reassessment, penalty, interest, prosecution, or recovery;');
      bullet('d) the Information Technology Act, 2000, including any allegation or action relating to cybercrime, electronic fraud, unauthorized transactions, identity misuse, or digital offences;');
      bullet('e) any directions, guidelines, advisories, circulars, alerts, or actions issued or taken by the Reserve Bank of India (RBI), Financial Intelligence Unit \u2013 India (FIU-IND), banks, payment system operators, exchanges, or any other regulatory or supervisory authority;');
      bullet('f) any other present or future law, rule, regulation, notification, guideline, or statutory instrument of similar nature or effect.');
      doc.moveDown(0.3);
      para('The Indemnifier expressly agrees and acknowledges that all statutory, regulatory, fiscal, and compliance-related risk, including but not limited to source of funds, legitimacy, traceability, reporting, and consequences thereof, shall rest solely, exclusively, and entirely upon the Indemnifier, and no part of such risk, liability, or consequence shall ever be attributed to or borne by the Indemnity Holder.');
      doc.moveDown(0.3);
      para('The Indemnifier further undertakes to bear, pay, and reimburse all costs, losses, damages, penalties, fines, legal expenses, professional fees, compounding amounts, and recovery expenses incurred or suffered by the Indemnity Holder in connection with any such statutory or regulatory action, without demur, dispute, set-off, or delay, and in accordance with the reimbursement obligations contained herein.');
      doc.moveDown(0.3);
      para('This indemnity shall apply irrespective of:');
      star('whether proceedings are initiated, contemplated, ongoing, concluded, dropped, or reopened;');
      star('whether liability arises from allegation, suspicion, inquiry, notice, or final order;');
      star('whether such action relates to past, present, or future transactions.');
      doc.moveDown(0.3);
      para('This clause shall operate as a complete statutory shield, shall be independent and severable, and shall survive perpetually, notwithstanding completion of the transaction, release of VDA, closure or restriction of accounts, termination of relationship, or passage of time.');

      // ── 22 ──
      doc.moveDown(0.5);
      sectionHeader('22', 'USER ACKNOWLEDGEMENT, SCAM WARNING, ASSUMPTION OF RISK & WAIVER OF CLAIMS');
      doc.moveDown(0.4);
      para('The Indemnifier/User hereby unequivocally, voluntarily, and irrevocably admits, acknowledges, and confirms that he/she has been clearly informed, expressly warned, and has fully understood the risks associated with Virtual Digital Asset (VDA) transactions, including but not limited to risks arising from frauds, scams, cheating, impersonation, social engineering, fake companies, fake websites, mobile applications, investment schemes, agents, intermediaries, friends, relatives, acquaintances, online contacts, marriage proposals, romance or love inducements, employment offers, or any similar representation or assurance made by any third party.');
      doc.moveDown(0.3);
      inline([
        { text: 'The Indemnifier/User expressly acknowledges that ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ', acting solely as Seller and Indemnity Holder, is limited only to the sale and release of VDA to the User\u2019s KuCoin wallet, and has no role, control, influence, advisory duty, fiduciary duty, or responsibility whatsoever over any subsequent use, transfer, storage, sale, withdrawal, or deployment of such VDA.', dyn: false },
      ]);
      doc.moveDown(0.3);
      para("The Indemnifier/User further agrees that once the VDA is released and credited to the User\u2019s KuCoin wallet, all risks, consequences, and outcomes automatically and irrevocably transfer to the User. Any subsequent act including but not limited to:");
      star('transferring VDA to any other wallet (personal or third-party);');
      star('depositing VDA into any other exchange, platform, application, website, or scheme;');
      star('selling, re-selling, or transferring VDA through P2P or off-platform transactions;');
      star('interacting with any person, company, or entity using such VDA;');
      doc.moveDown(0.3);
      para('shall be done entirely at the sole risk, cost, and responsibility of the Indemnifier/User.');
      doc.moveDown(0.3);
      para('The Indemnifier/User expressly agrees that any loss, theft, scam, freezing, misuse, regulatory action, or adverse consequence arising after the VDA has been credited\u2014whether due to negligence, inducement, misrepresentation, trust, reliance, mistake, or third-party conduct \u2014shall not create any liability upon the Seller/Indemnity Holder.');
      doc.moveDown(0.3);
      para('The Indemnifier/User hereby irrevocably waives, abandons, and relinquishes any right to:');
      star('challenge or dispute the transaction;');
      star('demand refund, reversal, replacement, or compensation;');
      star('file any complaint, charge, FIR, cyber complaint, consumer case, civil suit, criminal proceeding, or regulatory claim');
      doc.moveDown(0.3);
      inline([
        { text: 'against ', dyn: false },
        { text: safe(data.holderName), dyn: true },
        { text: ' (Seller / Indemnity Holder) on any ground whatsoever, including but not limited to allegation of misrepresentation, inducement, negligence, deficiency of service, unfair practice, or lack of warning.', dyn: false },
      ]);
      doc.moveDown(0.3);
      para('This waiver shall apply irrespective of whether the loss arises immediately or in the future, and irrespective of the quantum of loss.');
      doc.moveDown(0.3);
      para('This clause shall be absolute, unconditional, continuing, and irrevocable, shall operate as a complete bar by estoppel, and shall survive execution of this Bond, release of VDA, and closure of the transaction without limitation of time.');

      // ── 23 ──
      doc.moveDown(0.5);
      sectionHeader('23', 'VOLUNTARY EXECUTION DECLARATION');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably, unequivocally, and solemnly admits, acknowledges, and declares that the Indemnifier has carefully read, fully understood, and voluntarily executed this Indemnity Bond of his/her own free will, with full knowledge, awareness, and appreciation of its nature, scope, effect, and legal consequences.');
      doc.moveDown(0.3);
      para('The Indemnifier further expressly confirms and declares that:');
      bullet('a) this Bond has been executed without any coercion, compulsion, pressure, inducement, misrepresentation, mistake, or undue influence of any nature whatsoever;');
      bullet('b) the Indemnifier has had adequate opportunity to seek and obtain independent legal advice, and either has availed of the same or has knowingly and consciously chosen not to do so;');
      bullet('c) the terms, conditions, obligations, liabilities, waivers, and consequences contained herein have been clearly explained and fully understood, and the Indemnifier executes this Bond with complete clarity and informed consent;');
      bullet('d) the Indemnifier accepts and agrees that this Bond constitutes a valid, binding, enforceable, and legally effective obligation, and waives any right to challenge the same on grounds of lack of understanding, misinterpretation, ignorance, hardship, or subsequent regret.');
      doc.moveDown(0.3);
      para('This admission and acknowledgement shall operate as a conclusive estoppel against the Indemnifier and shall forever bar any challenge to the validity, enforceability, or binding nature of this Bond on any ground relating to execution, consent, or understanding.');

      // ── 24 ──
      doc.moveDown(0.5);
      sectionHeader('24', 'DIGITAL EXECUTION, ELECTRONIC SIGNATURE & LEGAL VALIDITY');
      doc.moveDown(0.4);
      para('The Indemnifier hereby irrevocably declares, confirms, and admits that this Indemnity Bond is being executed, signed, and authenticated through Digital / Electronic Signature, including but not limited to e-sign, Aadhaar-based e-sign, DSC, platform-based digital consent, or any legally recognized electronic mode, in full compliance with the Information Technology Act, 2000, and the rules, regulations, and amendments made thereunder.');
      doc.moveDown(0.3);
      para('The Indemnifier expressly agrees and acknowledges that such Digital / Electronic Signature shall have the same force, validity, authenticity, and enforceability as a physical handwritten signature under Indian law, and shall be final, binding, conclusive, and legally enforceable for all purposes whatsoever.');
      doc.moveDown(0.3);
      para('The Indemnifier further waives, abandons, and relinquishes any present or future right to challenge, dispute, deny, or question the validity, authenticity, execution, timing, consent, admissibility, or enforceability of this Indemnity Bond on any ground whatsoever, including but not limited to:');
      star('absence of physical signature,');
      star('absence of wet ink signature,');
      star('mode or method of digital execution,');
      star('electronic form or storage,');
      star('alleged lack of understanding,');
      star('alleged coercion, inducement, or misrepresentation,');
      star('technical defect, system error, or platform limitation.');
      doc.moveDown(0.3);
      para('The Indemnifier unconditionally consents to the admissibility of this Indemnity Bond as primary evidence in any court, tribunal, arbitration, regulatory authority, law-enforcement agency, bank, or government authority, without the requirement of further proof or certification.');
      doc.moveDown(0.3);
      para('The Indemnifier categorically admits that this Indemnity Bond has been read, understood, digitally signed voluntarily, with full legal awareness, and after understanding its absolute, unlimited, and continuing legal consequences, and that no clause, word, sentence, or obligation herein shall be interpreted in favour of the Indemnifier in any dispute.');
      doc.moveDown(0.3);
      para('This clause shall survive termination, expiry, cancellation, or invalidity of any related transaction and shall remain perpetual, binding, and enforceable without limitation of time.');

      // ── SIGNATURE PAGE ──────────────────────────────────────────────────────
      if (doc.y + 180 > maxY) addPage();
      doc.moveDown(1);

      subHead('INDEMNIFIER / BUYER');
      para('Signature:');
      inline([{ text: 'Name: ' }, { text: safe(data.indemnifierName), dyn: true }]);
      inline([{ text: 'Date: ' }, { text: safe(data.transactionDate), dyn: true }]);

      doc.moveDown(0.8);
      subHead('INDEMNITY HOLDER / SELLER');
      para('Signature:');
      inline([
        { text: 'Name: ', dyn: false },
        { text: safe(data.holderName), dyn: true },
      ]);
      inline([{ text: 'Date: ' }, { text: safe(data.transactionDate), dyn: true }]);

      doc.moveDown(1.5);
      if (doc.y + 90 > maxY) addPage();

      // Separator
      const sepY = doc.y;
      doc.moveTo(M, sepY).lineTo(M + W, sepY).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      doc.y = sepY + 20;

      const sigW = 200;
      const sig1X = M + 20;
      const sig2X = PAGE_W - M - sigW - 20;
      const sigLineY = doc.y + 5;

      doc.moveTo(sig1X, sigLineY).lineTo(sig1X + sigW, sigLineY).strokeColor(BLK).lineWidth(1.5).stroke();
      doc.moveTo(sig2X, sigLineY).lineTo(sig2X + sigW, sigLineY).strokeColor(BLK).lineWidth(1.5).stroke();

      doc.fontSize(11).font('Helvetica').fillColor('#888888')
        .text('Digital Signature', sig1X, sigLineY + 5, { width: sigW, align: 'center' });
      doc.text('Digital Signature', sig2X, sigLineY + 5, { width: sigW, align: 'center' });

      doc.fontSize(11).font('Helvetica-Bold').fillColor(BLK)
        .text('BUYER SIGNATURE', sig1X, sigLineY + 22, { width: sigW, align: 'center' });
      doc.text('SELLER SIGNATURE', sig2X, sigLineY + 22, { width: sigW, align: 'center' });

      // ── TRANSACTION COMPLIANCE CERTIFICATE ─────────────────────────────────
      doc.addPage();
      doc.x = M;
      doc.y = HEADER_BOTTOM_Y;

      doc.fontSize(18).font('Helvetica-Bold').fillColor('#2563eb')
        .text('TRANSACTION COMPLIANCE CERTIFICATE', M, doc.y, { width: W, align: 'center' });
      doc.moveDown(1.5);

      const tblX = M;
      const tblW = W;
      const c1 = tblW * 0.5;
      const rH = 32;

      const tblHdr = (y, l1, l2, col) => {
        doc.rect(tblX, y, tblW, rH).fill(col);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#fff')
          .text(l1, tblX + 8, y + 9, { width: c1 - 16 });
        doc.text(l2, tblX + c1 + 8, y + 9, { width: c1 - 16 });
        return y + rH;
      };

      const tblRow = (y, l, v, shade) => {
        if (shade) doc.rect(tblX, y, tblW, rH).fill('#f8fafc');
        doc.rect(tblX, y, tblW, rH).strokeColor('#e2e8f0').lineWidth(0.4).stroke();
        doc.fontSize(11).font('Helvetica').fillColor(BLK)
          .text(l, tblX + 8, y + 9, { width: c1 - 16 });
        doc.fontSize(11).font('Helvetica').fillColor(BLK)
          .text(v, tblX + c1 + 8, y + 9, { width: c1 - 16 });
        return y + rH;
      };

      let ty = doc.y;
      ty = tblHdr(ty, 'Compliance Question', 'User Response', '#2563eb');
      ty = tblRow(ty, 'Q1: Funds used are personal?', safe(data.q1) || 'YES (OWN FUNDS)', false);
      ty = tblRow(ty, 'Q2: Funds legal source?', safe(data.q2) || 'CONFIRMED (LEGAL)', true);
      ty = tblRow(ty, 'Q3: Profession', safe(data.q3), false);
      ty = tblRow(ty, 'Q4: Refund Agreement', safe(data.q4) || 'AGREED (24H)', true);
      ty = tblRow(ty, 'Q5: Purpose of Buying', safe(data.q5), false);

      doc.y = ty + 22;

      ty = doc.y;
      ty = tblHdr(ty, 'Identity Field', 'Verified Data', '#059669');
      ty = tblRow(ty, 'Full Name', safe(data.indemnifierName), false);
      ty = tblRow(ty, 'Email', safe(data.buyerEmail), true);
      ty = tblRow(ty, 'Mobile Number', safe(data.indemnifierMobile), false);
      ty = tblRow(ty, 'UTR Reference', safe(data.utrNumber), true);
      ty = tblRow(ty, 'Amount Paid', `INR ${safe(data.inrAmountPaid)}`, false);
      ty = tblRow(ty, 'Aadhaar Number', safe(data.indemnifierAadhaar), true);
      ty = tblRow(ty, 'PAN Number', safe(data.indemnifierPAN), false);

      doc.y = ty + 10;

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

module.exports = generateIndemnityPDF;
