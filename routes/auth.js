const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', { error: null, title: 'Login' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) return res.render('login', { error: 'Invalid email or password', title: 'Login' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Invalid email or password', title: 'Login' });
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect('/');
  });
});

router.get('/signup', (req, res) => {
  res.render('signup', { error: null, title: 'Sign Up' });
});

router.post('/signup', async (req, res) => {
    const { name, email, password, role, phone, gender, address } = req.body;
    if (!['host', 'planner'].includes(role)) {
        return res.render('signup', { error: 'Invalid role selected', title: 'Sign Up' });
    }
    const hashed = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (name, email, password, role, phone, gender, address) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, hashed, role, phone, gender, address],
        function(err) {
            if (err) return res.render('signup', { error: 'Email already exists', title: 'Sign Up' });
            res.redirect('/login');
        });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;