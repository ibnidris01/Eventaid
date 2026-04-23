const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const { generateResetToken } = require('../utils/token');
const { sendPasswordResetEmail } = require('../utils/mailer');
const router = express.Router();

// GET forgot password form
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', { error: null, message: null });
});

// POST forgot password – send reset email
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.render('forgot-password', { error: 'Email is required', message: null });

    // Check if user exists
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
            // For security, don't reveal that email doesn't exist
            return res.render('forgot-password', { error: null, message: 'If that email exists, we sent a reset link.' });
        }

        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Store token in DB
        db.run('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)',
            [email, token, expiresAt.toISOString()], async (err) => {
                if (err) {
                    console.error(err);
                    return res.render('forgot-password', { error: 'Something went wrong', message: null });
                }
                const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
                await sendPasswordResetEmail(email, resetLink);
                res.render('forgot-password', { error: null, message: 'Check your email for a reset link.' });
            });
    });
});

// GET reset password form (with token)
router.get('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    db.get('SELECT * FROM password_resets WHERE token = ? AND expires_at > datetime("now")', [token], (err, reset) => {
        if (err || !reset) {
            return res.render('reset-password', { token: null, error: 'Invalid or expired reset link.', message: null });
        }
        res.render('reset-password', { token, error: null, message: null });
    });
});

// POST reset password – update password
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
        return res.render('reset-password', { token, error: 'Password must be at least 6 characters.', message: null });
    }

    db.get('SELECT * FROM password_resets WHERE token = ? AND expires_at > datetime("now")', [token], async (err, reset) => {
        if (err || !reset) {
            return res.render('reset-password', { token: null, error: 'Invalid or expired reset link.', message: null });
        }

        const hashed = await bcrypt.hash(password, 10);
        db.run('UPDATE users SET password = ? WHERE email = ?', [hashed, reset.email], (err) => {
            if (err) {
                console.error(err);
                return res.render('reset-password', { token, error: 'Failed to update password.', message: null });
            }
            // Delete used reset tokens for this email
            db.run('DELETE FROM password_resets WHERE email = ?', [reset.email]);
            res.redirect('/login?reset=success');
        });
    });
});

module.exports = router;