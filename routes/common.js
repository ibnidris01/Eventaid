const express = require('express');
const router = express.Router();
const db = require('../database');

// Get Account page (redirect to actual account route)
router.get('/get-account', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.redirect('/account');
});

// Help & Support – GET (no success message)
router.get('/help-support', (req, res) => {
    res.render('help-support', { user: req.session.user, title: 'Help & Support', success: null });
});

// Contact form submission
router.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;
    // You can optionally send email here
    res.render('help-support', { user: req.session.user, title: 'Help & Support', success: 'Message sent! We will reply soon.' });
});

// Event Proposals – redirect based on role
router.get('/event-proposals', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const role = req.session.user.role;
    if (role === 'host') return res.redirect('/host/event-proposals');
    if (role === 'planner') return res.redirect('/planner/my-proposals');
    res.redirect('/');
});

// Announcements – public view
router.get('/announcements', (req, res) => {
    db.all('SELECT a.*, u.name as author FROM announcements a JOIN users u ON a.created_by = u.id ORDER BY a.created_at DESC', (err, announcements) => {
        if (err) announcements = [];
        res.render('public-announcements', { user: req.session.user, announcements, title: 'Announcements' });
    });
});

// Referrer (placeholder)
router.get('/referrer', (req, res) => {
    res.render('referrer', { user: req.session.user, title: 'Referrer Program' });
});

module.exports = router;