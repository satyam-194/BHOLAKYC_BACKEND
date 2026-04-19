const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const generateKycPDF = require('./generateKycPDF');
const generateIndemnityPDF = require('./generateIndemnityPDF');
const { mergePdfBuffers } = require('./mergePdfs');
const {
  INDEMNITY_FIELD_GROUPS,
  sanitizeAdminIndemnityBody,
  mergeIndemnityEnvDefaults
} = require('./indemnityPayload');

const app = express();

const PORT           = process.env.PORT            || 5001;
const MONGO_URI      = process.env.MONGO_URI       || 'mongodb://localhost:27017/kyc_db';
const ADMIN_USERNAME = (process.env.ADMIN_USERNAME ?? 'admin').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? 'admin1234').trim();

/** Comma-separated origins from env, plus any http://localhost:* / 127.0.0.1:* for dev. */
const envOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');

const corsOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (envOrigins.includes(origin) || isLocalDevOrigin(origin)) {
    return callback(null, origin);
  }
  callback(null, false);
};

const STORAGE_ROOT = path.join(__dirname, 'storage');
const IMAGE_ROOT   = path.join(STORAGE_ROOT, 'images');
const VIDEO_ROOT   = path.join(STORAGE_ROOT, 'videos');
const PDF_ROOT     = path.join(STORAGE_ROOT, 'pdfs');
const MERGED_ROOT  = path.join(STORAGE_ROOT, 'merged');

[STORAGE_ROOT, IMAGE_ROOT, VIDEO_ROOT, PDF_ROOT, MERGED_ROOT].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Admin-Token'],
  credentials: true
}));
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));

app.use('/storage', express.static(STORAGE_ROOT));

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB database is connected.');
    await dropObsoleteUserIndexes();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    console.error(
      'Hint: start MongoDB locally (port 27017), or set MONGO_URI in backend/.env to a running instance (e.g. MongoDB Atlas).'
    );
    process.exit(1);
  });

const counterSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, unique: true },
    value: { type: Number, default: 0 }
  },
  { versionKey: false }
);
const Counter = mongoose.model('Counter', counterSchema);

const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  return counter.value;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

/** Maps a User document + optional INDEMNITY_* env defaults into generateIndemnityPDF fields. */
function buildIndemnityDataFromUser(user) {
  const dt = user.execution_date ? new Date(user.execution_date) : new Date();
  const safeDate = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const transactionDateStr = `${pad2(safeDate.getDate())}/${pad2(safeDate.getMonth() + 1)}/${safeDate.getFullYear()}`;
  const transactionTimeStr = `${pad2(safeDate.getHours())}:${pad2(safeDate.getMinutes())} IST`;

  return mergeIndemnityEnvDefaults({
    executionDay: String(safeDate.getDate()),
    executionMonth: MONTH_NAMES[safeDate.getMonth()],
    executionYear: String(safeDate.getFullYear()),
    holderName: '',
    holderFatherName: '',
    holderAadhaar: '',
    holderPAN: '',
    holderAddress: '',
    holderUID: '',
    indemnifierName: user.buyer_full_name || '',
    indemnifierFatherName: '',
    indemnifierAadhaar: user.buyer_aadhaar_no || '',
    indemnifierPAN: user.buyer_pan_no || '',
    indemnifierAddress: user.buyer_address || '',
    indemnifierMobile: user.buyer_mobile || '',
    buyerEmail: user.buyer_email || '',
    receiptNumber: '',
    receiptDate: '',
    receiptAmount: '',
    amountInWords: '',
    districtName: '',
    stampDutyPaidBy: '',
    grnNumber: '',
    vdaType: '',
    vdaQuantity: '',
    tdsRate: '',
    tdsAmount: '',
    netVdaQuantity: '',
    transactionDate: transactionDateStr,
    transactionTime: transactionTimeStr,
    vdaAssetName: '',
    vdaQuantityExact: '',
    inrAmountPaid: user.amount || '',
    utrNumber: user.utr_reference_no || '',
    orderId: '',
    q1: user.q1 || '',
    q2: user.q2 || '',
    q3: user.q3 || '',
    q4: user.q4 || '',
    q5: user.q5 || ''
  });
}

const userSchema = new mongoose.Schema(
  {
    refId:            { type: String, default: '' },
    buyer_full_name:  { type: String, default: '' },
    buyer_email:      { type: String, default: '' },
    buyer_mobile:     { type: String, default: '' },
    buyer_aadhaar_no: { type: String, default: '' },
    buyer_pan_no:     { type: String, default: '' },
    buyer_address:    { type: String, default: '' },
    utr_reference_no: { type: String, default: '' },
    amount:           { type: String, default: '' },
    q1: { type: String, default: '' },
    q2: { type: String, default: '' },
    q3: { type: String, default: '' },
    q4: { type: String, default: '' },
    q5: { type: String, default: '' },
    proof_status:            { type: String, default: 'Not Required' },
    phase_access:            { type: Boolean, default: false },
    phase1_completed:        { type: Boolean, default: false },
    final_kyc_completed:     { type: Boolean, default: false },
    admin_status:            { type: String, default: 'Pending' },
    execution_date:          { type: Date, default: Date.now },
    purpose_proof_path:      { type: String, default: '' },
    path_aadhaar_front:      { type: String, default: '' },
    path_aadhaar_back:       { type: String, default: '' },
    path_pan_card:           { type: String, default: '' },
    path_selfie_live:        { type: String, default: '' },
    path_video_verification: { type: String, default: '' },
    pdf_path:                { type: String, default: '' },
    indemnity_pdf_path:      { type: String, default: '' }
  },
  { versionKey: false }
);
const User = mongoose.model('User', userSchema);

const adminIndemnityBondSchema = new mongoose.Schema(
  {
    bondId:   { type: String, required: true, unique: true },
    memo:     { type: String, default: '' },
    pdf_path: { type: String, default: '' }
  },
  { versionKey: false, timestamps: { createdAt: true, updatedAt: false } }
);
const AdminIndemnityBond = mongoose.model('AdminIndemnityBond', adminIndemnityBondSchema);

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/webm', 'video/mp4'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Only JPEG, PNG and WEBP images are allowed.`), false);
  }
};

const combinedFileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video type. Only WEBM and MP4 are allowed.'), false);
    }
  } else {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type for ${file.fieldname}. Only JPEG, PNG and WEBP images are allowed.`), false);
    }
  }
};

const sanitizeRefId = (refId) => {
  if (!refId || typeof refId !== 'string') return null;
  if (!/^CN-\d+$/.test(refId)) return null;
  return refId;
};

const imageFieldMap = {
  purpose_proof: 'purpose_proof',
  aadhaarFront:  'aadhaar_front',
  aadhaarBack:   'aadhaar_back',
  panCard:       'pan',
  selfie:        'selfie'
};

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const refId = sanitizeRefId(req.generatedRefId || req.body.refId);
    if (!refId) return cb(new Error('Invalid reference ID'), null);
    const dir = path.join(IMAGE_ROOT, refId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const baseName = imageFieldMap[file.fieldname] || 'file';
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())
      ? path.extname(file.originalname).toLowerCase()
      : '.jpg';
    cb(null, `${baseName}${ext}`);
  }
});

const combinedStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const refId = sanitizeRefId(req.kycUploadRefId || req.body.refId);
    if (!refId) return cb(new Error('Invalid reference ID'), null);
    const dir = file.fieldname === 'video'
      ? path.join(VIDEO_ROOT, refId)
      : path.join(IMAGE_ROOT, refId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const fieldMap = { ...imageFieldMap, video: 'video' };
    const baseName = fieldMap[file.fieldname] || 'file';
    if (file.fieldname === 'video') {
      const ext = ['.webm', '.mp4'].includes(path.extname(file.originalname).toLowerCase())
        ? path.extname(file.originalname).toLowerCase()
        : '.webm';
      return cb(null, `${baseName}${ext}`);
    }
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file.originalname).toLowerCase())
      ? path.extname(file.originalname).toLowerCase()
      : '.jpg';
    cb(null, `${baseName}${ext}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_IMAGE_SIZE }
});

const uploadCombined = multer({
  storage: combinedStorage,
  fileFilter: combinedFileFilter,
  limits: { fileSize: MAX_VIDEO_SIZE }
});

const relPath = (subDir, refId, filename) =>
  filename ? `${subDir}/${refId}/${filename}` : '';

const absPath = (rel) => (rel ? path.join(STORAGE_ROOT, rel) : '');

const sanitizeString = (val, maxLen = 200) => {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
};

/** Safe relative path under storage for merge inputs: pdfs/x.pdf or indemnity_pdfs/x.pdf */
function sanitizeMergeInputPath(input) {
  const s = sanitizeString(input, 160).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!/^(pdfs|indemnity_pdfs)\/[A-Za-z0-9][A-Za-z0-9_.-]*\.pdf$/i.test(s)) return null;
  if (s.includes('..')) return null;
  return s;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }
});

app.get('/api/admin/indemnity-bond/fields', (req, res) => {
  res.json({ groups: INDEMNITY_FIELD_GROUPS });
});

app.get('/api/admin/indemnity-bonds', async (req, res) => {
  try {
    const rows = await AdminIndemnityBond.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(
      rows.map((d) => ({
        bondId: d.bondId,
        memo: d.memo,
        pdf_path: d.pdf_path,
        createdAt: d.createdAt
      }))
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to list indemnity bonds.' });
  }
});

app.post('/api/admin/indemnity-bond/generate', async (req, res) => {
  try {
    const { memo, payload } = sanitizeAdminIndemnityBody(req.body || {});
    const n = await getNextSequence('admin_indemnity_bond');
    const bondId = `IB-${n}`;
    await generateIndemnityPDF(payload, bondId);
    const pdf_path = `indemnity_pdfs/${bondId}.pdf`;
    await AdminIndemnityBond.create({ bondId, memo, pdf_path });
    res.json({ success: true, bondId, pdf_path, memo });
  } catch (err) {
    console.error('Admin indemnity generate:', err.message);
    res.status(500).json({ error: 'Could not generate indemnity PDF.' });
  }
});

app.delete('/api/admin/indemnity-bond/:bondId', async (req, res) => {
  try {
    const bondId = sanitizeString(req.params.bondId, 32);
    if (!/^IB-\d+$/.test(bondId)) {
      return res.status(400).json({ error: 'Invalid bond id.' });
    }
    await AdminIndemnityBond.deleteOne({ bondId });
    const abs = path.join(STORAGE_ROOT, 'indemnity_pdfs', `${bondId}.pdf`);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bond.' });
  }
});

app.get('/api/admin/pdf-merge-sources', (req, res) => {
  try {
    const listPdf = (subDir) => {
      const dir = path.join(STORAGE_ROOT, subDir);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((f) => /\.pdf$/i.test(f))
        .map((f) => `${subDir}/${f}`)
        .sort();
    };
    res.json({
      bondPdfs: listPdf('indemnity_pdfs'),
      kycPdfs: listPdf('pdfs')
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list PDF files.' });
  }
});

app.post('/api/admin/merge-pdfs', async (req, res) => {
  try {
    const bondPath = sanitizeMergeInputPath(req.body.bondPath || req.body.bond);
    const kycPath = sanitizeMergeInputPath(req.body.kycPath || req.body.kyc);
    if (!bondPath || !kycPath) {
      return res.status(400).json({
        error:
          'Invalid paths. Use bondPath and kycPath like indemnity_pdfs/CN-1.pdf and pdfs/CN-1.pdf.'
      });
    }
    const absBond = path.join(STORAGE_ROOT, bondPath);
    const absKyc = path.join(STORAGE_ROOT, kycPath);
    if (!fs.existsSync(absBond) || !fs.existsSync(absKyc)) {
      return res.status(404).json({ error: 'One or both PDFs were not found.' });
    }
    const outBuf = await mergePdfBuffers([
      fs.readFileSync(absBond),
      fs.readFileSync(absKyc)
    ]);
    const n = await getNextSequence('admin_pdf_merge');
    const outName = `M-${n}.pdf`;
    const outRel = `merged/${outName}`;
    fs.writeFileSync(path.join(STORAGE_ROOT, outRel), outBuf);
    res.json({ success: true, pdf_path: outRel, filename: outName });
  } catch (err) {
    console.error('merge-pdfs:', err.message);
    res.status(500).json({ error: 'PDF merge failed. Files may be corrupted or encrypted.' });
  }
});

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const id       = sanitizeString(req.body.id,       50);
  const password = sanitizeString(req.body.password, 100);

  if (!id || !password) {
    return res.status(400).json({ success: false, error: 'ID and password are required.' });
  }

  try {
    if (id !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, error: 'Invalid Credentials' });
    }

    return res.json({ success: true, message: 'Login Successful' });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.get('/api/admin/all-users', async (req, res) => {
  try {
    const users = await User.find(
      {},
      {
        refId: 1, buyer_full_name: 1, buyer_mobile: 1,
        utr_reference_no: 1, amount: 1,
        admin_status: 1, proof_status: 1,
        phase_access: 1, final_kyc_completed: 1,
        execution_date: 1
      }
    ).sort({ execution_date: -1 });

    res.json(
      users.map((u) => ({
        id:                  u._id.toString(),
        refId:               u.refId,
        buyer_full_name:     u.buyer_full_name,
        buyer_mobile:        u.buyer_mobile,
        utr_reference_no:    u.utr_reference_no,
        amount:              u.amount,
        admin_status:        u.admin_status,
        proof_status:        u.proof_status,
        phase_access:        u.phase_access,
        final_kyc_completed: u.final_kyc_completed,
        execution_date:      u.execution_date
      }))
    );
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.get('/api/admin/user-details/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id:                      user._id.toString(),
      refId:                   user.refId,
      buyer_full_name:         user.buyer_full_name,
      buyer_email:             user.buyer_email,
      buyer_mobile:            user.buyer_mobile,
      utr_reference_no:        user.utr_reference_no,
      amount:                  user.amount,
      q1: user.q1, q2: user.q2, q3: user.q3, q4: user.q4, q5: user.q5, buyer_pan_no: user.buyer_pan_no, buyer_aadhaar_no: user.buyer_aadhaar_no, buyer_address: user.buyer_address,
      purpose_proof_path:      user.purpose_proof_path,
      proof_status:            user.proof_status,
      phase_access:            user.phase_access,
      phase1_completed:        user.phase1_completed,
      final_kyc_completed:     user.final_kyc_completed,
      admin_status:            user.admin_status,
      execution_date:          user.execution_date,
      path_aadhaar_front:      user.path_aadhaar_front,
      path_aadhaar_back:       user.path_aadhaar_back,
      path_pan_card:           user.path_pan_card,
      path_selfie_live:        user.path_selfie_live,
      path_video_verification: user.path_video_verification,
      pdf_path:                user.pdf_path,
      indemnity_pdf_path:      user.indemnity_pdf_path
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user details.' });
  }
});

const phase1Limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const PROOF_REQUIRED_PURPOSES = ['Spot Trading', 'Futures Trading', 'HOLD'];
const VALID_Q5_VALUES = ['Spot Trading', 'Futures Trading', 'HOLD', 'Investment', 'Other'];

app.post(
  '/api/phase1-submit',
  phase1Limiter,
  async (req, res, next) => {
    try {
      const nextNumber = await getNextSequence('kyc_ref');
      req.generatedRefId = `CN-${nextNumber}`;
      next();
    } catch (err) {
      res.status(500).json({ error: 'Failed to send reference ID.' });
    }
  },
  uploadImage.fields([{ name: 'purpose_proof', maxCount: 1 }]),
  async (req, res) => {
    try {
      const d     = req.body;
      const refId = req.generatedRefId;

      const fullname    = sanitizeString(d.fullname,    100);
      const email       = sanitizeString(d.email,       150);
      const mobile      = sanitizeString(d.buyer_mobile, 15);
      const utr         = sanitizeString(d.utr,          50);
      const amount      = sanitizeString(d.amount,       20);
      const q1          = sanitizeString(d.q1,          200);
      const q2          = sanitizeString(d.q2,          200);
      const q3          = sanitizeString(d.q3,          200);
      const q4          = sanitizeString(d.q4,          200);
      const q5          = sanitizeString(d.q5,          100);

      if (!fullname || !mobile || !amount) {
        return res.status(400).json({ success: false, error: 'Required fields are missing.' });
      }

      if (q5 && !VALID_Q5_VALUES.includes(q5)) {
        return res.status(400).json({ success: false, error: 'Invalid purpose value.' });
      }

      const proofRequired = PROOF_REQUIRED_PURPOSES.includes(q5);
      const proofFile     = req.files?.purpose_proof?.[0] || null;

      if (proofRequired && !proofFile) {
        return res.status(400).json({ success: false, error: 'Proof image is required for the selected purpose.' });
      }

      const purposeProofPath = proofFile
        ? relPath('images', refId, proofFile.filename)
        : '';

      const newUser = new User({
        refId,
        buyer_full_name:  fullname,
        buyer_email: email,
        buyer_mobile:     mobile,
        utr_reference_no: utr,
        amount,
        q1, q2, q3, q4, q5,
        purpose_proof_path:  purposeProofPath,
        proof_status:        proofRequired ? 'Pending' : 'Not Required',
        phase_access:        !proofRequired,
        phase1_completed:    true,
        final_kyc_completed: false,
        admin_status:        'Pending',
        execution_date:      new Date()
      });

      const saved = await newUser.save();

      res.json({
        success:      true,
        id:           saved._id.toString(),
        refId:        saved.refId,
        proof_status: saved.proof_status,
        phase_access: saved.phase_access
      });
    } catch (err) {
      console.error('Phase 1 Submit Error:', err.message);
      res.status(500).json({ error: 'Submission failed. Please try again.' });
    }
  }
);

app.post('/api/check-phase-access', async (req, res) => {
  try {
    const refId       = sanitizeString(req.body.refId,        20);
    const buyerMobile = sanitizeString(req.body.buyer_mobile, 15);

    if (!refId || !buyerMobile) {
      return res.status(400).json({ success: false, error: 'Ref ID and mobile are required.' });
    }

    const safeRefId = sanitizeRefId(refId);
    if (!safeRefId) {
      return res.status(400).json({ success: false, error: 'Invalid Ref ID format.' });
    }

    const user = await User.findOne(
      { refId: safeRefId, buyer_mobile: buyerMobile },
      { refId: 1, proof_status: 1, phase_access: 1, buyer_full_name: 1 }
    );

    if (!user) return res.status(404).json({ success: false, error: 'Record not found.' });

    res.json({
      success:         true,
      id:              user._id.toString(),
      refId:           user.refId,
      proof_status:    user.proof_status,
      phase_access:    user.phase_access,
      buyer_full_name: user.buyer_full_name
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check phase access.' });
  }
});

app.post(
  '/api/finalize-kyc/:id',
  (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID.' });
    }
    next();
  },
  async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id).select('refId phase_access');
      if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
      if (!user.phase_access) {
        return res.status(403).json({ success: false, error: 'Phase 2 access not approved yet.' });
      }
      req.kycUploadRefId = user.refId;
      req.body = req.body || {};
      req.body.refId = user.refId;
      next();
    } catch (err) {
      next(err);
    }
  },
  uploadCombined.fields([
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack',  maxCount: 1 },
    { name: 'panCard',      maxCount: 1 },
    { name: 'selfie',       maxCount: 1 },
    { name: 'video',        maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

      const refId = user.refId;

      const pickImg = (fieldName, existing) => {
        const f = req.files?.[fieldName]?.[0];
        return f ? relPath('images', refId, f.filename) : existing;
      };
      const pickVid = (fieldName, existing) => {
        const f = req.files?.[fieldName]?.[0];
        return f ? relPath('videos', refId, f.filename) : existing;
      };

      const aadhaarNo = sanitizeString(req.body.aadhaar_no, 20);
      const panNo     = sanitizeString(req.body.pan_no,     20);
      const utrNo     = sanitizeString(req.body.utr,        50);

      if (aadhaarNo) user.buyer_aadhaar_no  = aadhaarNo;
      if (panNo)     user.buyer_pan_no      = panNo;
      if (utrNo)     user.utr_reference_no  = utrNo;

      user.path_aadhaar_front      = pickImg('aadhaarFront', user.path_aadhaar_front);
      user.path_aadhaar_back       = pickImg('aadhaarBack',  user.path_aadhaar_back);
      user.path_pan_card           = pickImg('panCard',      user.path_pan_card);
      user.path_selfie_live        = pickImg('selfie',       user.path_selfie_live);
      user.path_video_verification = pickVid('video',        user.path_video_verification);
      user.final_kyc_completed     = true;
      user.admin_status            = 'Pending';

      await user.save();

      await generateKycPDF({
        refId: user.refId,
        buyer_full_name: user.buyer_full_name,
        buyer_mobile: user.buyer_mobile,
        buyer_email: user.buyer_email,
        buyer_pan_no: user.buyer_pan_no,
        buyer_aadhaar_no: user.buyer_aadhaar_no,
        utr_reference_no: user.utr_reference_no,
        amount: user.amount,
        q1: user.q1,
        q2: user.q2,
        q3: user.q3,
        q4: user.q4,
        q5: user.q5,
        proof_status: user.proof_status,
        purpose_proof_path: user.purpose_proof_path ? absPath(user.purpose_proof_path) : '',
        path_aadhaar_front: absPath(user.path_aadhaar_front),
        path_aadhaar_back: absPath(user.path_aadhaar_back),
        path_pan_card: absPath(user.path_pan_card),
        path_selfie_live: user.path_selfie_live ? absPath(user.path_selfie_live) : '',
        path_video_verification: user.path_video_verification || '',
        execution_date: user.execution_date
      });

      user.pdf_path = `pdfs/${user.refId}.pdf`;

      try {
        await generateIndemnityPDF(buildIndemnityDataFromUser(user), user.refId);
        user.indemnity_pdf_path = `indemnity_pdfs/${user.refId}.pdf`;
      } catch (indErr) {
        console.error('Indemnity PDF Error:', indErr.message);
        user.indemnity_pdf_path = '';
      }

      await user.save();

      res.json({
        success:  true,
        id:       user._id.toString(),
        refId:    user.refId,
        pdf_path: user.pdf_path,
        indemnity_pdf_path: user.indemnity_pdf_path || ''
      });
    } catch (err) {
      console.error('Finalize KYC Error:', err.message);
    res.status(500).json({ error: 'KYC finalization failed. Please try again.' });
  }
});

const VALID_PROOF_STATUSES = ['Pending', 'Approved', 'Rejected', 'Not Required'];
const VALID_ADMIN_STATUSES = ['Pending', 'Verified', 'Rejected'];

app.post('/api/admin/update-proof-status', async (req, res) => {
  try {
    const id           = sanitizeString(req.body.id,           30);
    const proof_status = sanitizeString(req.body.proof_status, 20);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (!VALID_PROOF_STATUSES.includes(proof_status)) {
      return res.status(400).json({ error: 'Invalid proof status value.' });
    }

    const update = { proof_status };
    if (proof_status === 'Approved') update.phase_access = true;
    if (proof_status === 'Rejected') update.phase_access = false;

    await User.findByIdAndUpdate(id, update);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update proof status.' });
  }
});

app.post('/api/admin/update-status', async (req, res) => {
  try {
    const id     = sanitizeString(req.body.id,     30);
    const status = sanitizeString(req.body.status, 20);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (!VALID_ADMIN_STATUSES.includes(status)) {
      return res.status(400). json({ error: 'Invalid status value.' });
    }

    await User.findByIdAndUpdate(id, { admin_status: status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

app.delete('/api/admin/delete-user/:userId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.json({ success: true, affectedRows: 0 });

    const refId = user.refId;
    const safeRefId = sanitizeRefId(refId);

    if (safeRefId) {
      const imgDir = path.join(IMAGE_ROOT, safeRefId);
      const vidDir = path.join(VIDEO_ROOT, safeRefId);
      const pdfFile = path.join(PDF_ROOT, `${safeRefId}.pdf`);
      const indemnityFile = path.join(STORAGE_ROOT, 'indemnity_pdfs', `${safeRefId}.pdf`);

      if (fs.existsSync(imgDir))  fs.rmSync(imgDir,  { recursive: true, force: true });
      if (fs.existsSync(vidDir))  fs.rmSync(vidDir,  { recursive: true, force: true });
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
      if (fs.existsSync(indemnityFile)) fs.unlinkSync(indemnityFile);
    }

    await User.findByIdAndDelete(req.params.userId);

    res.json({ success: true, message: 'User and all associated files deleted.', affectedRows: 1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Max 5 MB for images, 50 MB for video.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

/** Field names that are not on the KYC User schema but may have leftover unique indexes in Atlas. */
const OBSOLETE_USER_INDEX_FIELDS = ['username', 'email'];

/**
 * Drops stray unique indexes (e.g. username_1, email_1) on `users`. This app uses
 * `buyer_email`, not `email`, and has no `username`; unique indexes on missing fields
 * store null and cause E11000 duplicate key for every new row.
 */
async function dropObsoleteUserIndexes() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const coll = db.collection('users');
    const indexes = await coll.indexes();
    for (const idx of indexes) {
      const key = idx.key || {};
      if (idx.name === '_id_') continue;
      const obsolete = OBSOLETE_USER_INDEX_FIELDS.some((f) =>
        Object.prototype.hasOwnProperty.call(key, f)
      );
      if (obsolete) {
        await coll.dropIndex(idx.name);
        console.log(`Dropped obsolete index "${idx.name}" on users collection.`);
      }
    }
  } catch (err) {
    console.warn('dropObsoleteUserIndexes:', err.message);
  }
}

