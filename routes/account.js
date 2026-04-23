const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const router = express.Router();

// Middleware: user must be logged in
function isAuthenticated(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}
router.use(isAuthenticated);

// GET account page
router.get('/', (req, res) => {
    const userId = req.session.user.id;
    console.log(`Fetching account for user ID: ${userId}`); // Debug log

    db.get('SELECT id, name, email, phone, address, gender, dob, profile_pic FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Database error');
        }
        if (!user) {
            console.error(`No user found with ID: ${userId}`);
            return res.status(404).send('User not found');
        }
        res.render('account', { user: req.session.user, profile: user, error: null, success: null });
    });
});

// POST update profile
router.post('/update', (req, res) => {
    const { name, email, phone, address, gender, dob } = req.body;
    const userId = req.session.user.id;

    db.run(`UPDATE users SET name = ?, email = ?, phone = ?, address = ?, gender = ?, dob = ? WHERE id = ?`,
        [name, email, phone, address, gender, dob, userId], function(err) {
            if (err) {
                console.error(err);
                return res.render('account', { user: req.session.user, profile: req.body, error: 'Update failed', success: null });
            }
            // Update session name/email
            req.session.user.name = name;
            req.session.user.email = email;
            // Re-fetch the updated user to display
            db.get('SELECT id, name, email, phone, address, gender, dob, profile_pic FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                res.render('account', { user: req.session.user, profile: updatedUser, error: null, success: 'Profile updated successfully!' });
            });
        });
});

// POST change password
router.post('/change-password', async (req, res) => {
    const { current_password, new_password } = req.body;
    const userId = req.session.user.id;

    db.get('SELECT password FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) {
            return res.render('account', { user: req.session.user, profile: null, error: 'User not found', success: null });
        }
        const match = await bcrypt.compare(current_password, user.password);
        if (!match) {
            return res.render('account', { user: req.session.user, profile: null, error: 'Current password is incorrect', success: null });
        }
        const hashed = await bcrypt.hash(new_password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, userId], (err) => {
            if (err) {
                return res.render('account', { user: req.session.user, profile: null, error: 'Password change failed', success: null });
            }
            res.render('account', { user: req.session.user, profile: null, error: null, success: 'Password changed successfully!' });
        });
    });
});

module.exports = router;