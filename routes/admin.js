const express = require('express');
const db = require('../database');
const router = express.Router();

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}
router.use(isAdmin);

router.get('/dashboard', (req, res) => {
  db.get('SELECT COUNT(*) as users FROM users', (err, userCount) => {
    db.get('SELECT COUNT(*) as planners FROM users WHERE role = "planner"', (err2, plannerCount) => {
      db.get('SELECT COUNT(*) as hosts FROM users WHERE role = "host"', (err3, hostCount) => {
        db.get('SELECT COUNT(*) as events FROM events', (err4, eventCount) => {
          res.render('admin-dashboard', {
            user: req.session.user,
            userCount: userCount ? userCount.users : 0,
            plannerCount: plannerCount ? plannerCount.planners : 0,
            hostCount: hostCount ? hostCount.hosts : 0,
            eventCount: eventCount ? eventCount.events : 0,
            title: 'Admin Dashboard'
          });
        });
      });
    });
  });
});

// GET announcements list (admin)
router.get('/announcements', (req, res) => {
    db.all('SELECT * FROM announcements ORDER BY created_at DESC', (err, announcements) => {
        res.render('admin-announcements', { user: req.session.user, announcements, title: 'Manage Announcements' });
    });
});

// POST new announcement
router.post('/announcements', (req, res) => {
    const { title, content } = req.body;
    db.run('INSERT INTO announcements (title, content, created_by) VALUES (?, ?, ?)',
        [title, content, req.session.user.id], (err) => {
            res.redirect('/admin/announcements');
        });
});

// DELETE announcement
router.post('/announcements/delete/:id', (req, res) => {
    db.run('DELETE FROM announcements WHERE id = ?', [req.params.id], () => {
        res.redirect('/admin/announcements');
    });
});
module.exports = router;