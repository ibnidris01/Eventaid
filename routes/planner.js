const express = require('express');
const multer = require('multer');
const db = require('../database');
const { createTransferRecipient } = require('../utils/paystack'); // changed
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// ============================================================
// PUBLIC PROFILE – any logged‑in user (host, planner, admin) can view
// ============================================================
router.get('/public/:plannerId', (req, res) => {
  const { plannerId } = req.params;
  if (!req.session.user) return res.redirect('/login');

  db.get('SELECT id, name, email, phone, profile_pic FROM users WHERE id = ? AND role = "planner"', [plannerId], (err, planner) => {
    if (err || !planner) return res.status(404).send('Planner not found');

    db.all('SELECT * FROM portfolio WHERE planner_id = ? ORDER BY created_at DESC', [plannerId], (err2, portfolio) => {
      if (err2) return res.status(500).send('Error loading portfolio');
      res.render('planner-public-profile', { user: req.session.user, planner, portfolio });
    });
  });
});

// ============================================================
// PLANNER‑ONLY ROUTES (require planner role)
// ============================================================
function isPlanner(req, res, next) {
  if (req.session.user && req.session.user.role === 'planner') return next();
  res.redirect('/login');
}
router.use(isPlanner);

// Dashboard
router.get('/dashboard', (req, res) => {
  const plannerId = req.session.user.id;
  db.get('SELECT COUNT(*) as events FROM events WHERE status = "open"', (err, eventCount) => {
    db.get('SELECT COUNT(*) as proposals FROM proposals WHERE planner_id = ?', [plannerId], (err2, propCount) => {
      db.get('SELECT COALESCE(SUM(amount),0) as total FROM proposals WHERE planner_id = ? AND status = "accepted"', [plannerId], (err3, cost) => {
        db.all('SELECT * FROM portfolio WHERE planner_id = ?', [plannerId], (err4, portfolio) => {
          res.render('planner-dashboard', {
            user: req.session.user,
            eventCount: eventCount ? eventCount.events : 0,
            proposalCount: propCount ? propCount.proposals : 0,
            totalCost: cost ? cost.total : 0,
            portfolio,
            title: 'Planner Dashboard'
          });
        });
      });
    });
  });
});

// Browse available events
router.get('/available-events', (req, res) => {
  db.all('SELECT * FROM events WHERE status = "open" ORDER BY event_date ASC', (err, events) => {
    res.render('available-events', { user: req.session.user, events, title: 'Available Events' });
  });
});

// Submit a proposal
router.post('/submit-proposal', (req, res) => {
  const { event_id, amount, message } = req.body;
  const planner_id = req.session.user.id;
  db.run('INSERT INTO proposals (event_id, planner_id, amount, message) VALUES (?, ?, ?, ?)',
    [event_id, planner_id, amount, message],
    (err) => {
      res.redirect('/planner/available-events');
    });
});

// My proposals list
router.get('/my-proposals', (req, res) => {
  const plannerId = req.session.user.id;
  db.all(`SELECT p.*, e.title as event_title 
          FROM proposals p 
          JOIN events e ON p.event_id = e.id 
          WHERE p.planner_id = ?`, [plannerId], (err, proposals) => {
    res.render('my-proposals', { user: req.session.user, proposals, title: 'My Proposals' });
  });
});

// Upload portfolio
router.get('/upload-portfolio', (req, res) => {
  res.render('upload-portfolio', { error: null, user: req.session.user, title: 'Upload Portfolio' });
});

router.post('/upload-portfolio', upload.single('portfolioFile'), (req, res) => {
  const { title, category } = req.body;
  const filePath = req.file ? '/uploads/' + req.file.filename : null;
  if (!filePath) return res.render('upload-portfolio', { error: 'File required', user: req.session.user, title: 'Upload Portfolio' });
  db.run('INSERT INTO portfolio (planner_id, title, category, file_path) VALUES (?, ?, ?, ?)',
    [req.session.user.id, title, category, filePath],
    (err) => {
      if (err) return res.render('upload-portfolio', { error: 'DB error', user: req.session.user, title: 'Upload Portfolio' });
      res.redirect('/planner/dashboard');
    });
});

// Bank setup (for Paystack transfer recipient) – updated
router.get('/bank-setup', (req, res) => {
  res.render('bank-setup', { user: req.session.user, error: null, success: null });
});

router.post('/bank-setup', async (req, res) => {
  const { bank_code, account_number } = req.body;
  const userId = req.session.user.id;
  const userEmail = req.session.user.email;
  const userName = req.session.user.name;

  if (!bank_code || !account_number) {
    return res.render('bank-setup', { user: req.session.user, error: 'All fields required', success: null });
  }

  try {
    const recipientCode = await createTransferRecipient(userName, userEmail, bank_code, account_number);
    db.run('UPDATE users SET recipient_code = ? WHERE id = ?', [recipientCode, userId], (err) => {
      if (err) {
        console.error(err);
        return res.render('bank-setup', { user: req.session.user, error: 'Database error', success: null });
      }
      res.render('bank-setup', { user: req.session.user, error: null, success: 'Bank account linked successfully! You will receive payments after events are completed.' });
    });
  } catch (error) {
    console.error(error);
    res.render('bank-setup', { user: req.session.user, error: 'Failed to link bank account. Check details.', success: null });
  }
});

// Profile picture upload
router.get('/profile-pic', (req, res) => {
  res.render('upload-profile-pic', { user: req.session.user, error: null });
});

router.post('/profile-pic', upload.single('profilePic'), (req, res) => {
  if (!req.file) return res.render('upload-profile-pic', { user: req.session.user, error: 'No file uploaded' });
  const filePath = '/uploads/' + req.file.filename;
  db.run('UPDATE users SET profile_pic = ? WHERE id = ?', [filePath, req.session.user.id], (err) => {
    if (err) return res.render('upload-profile-pic', { user: req.session.user, error: 'Database error' });
    req.session.user.profile_pic = filePath;
    res.redirect('/planner/dashboard');
  });
});

module.exports = router;