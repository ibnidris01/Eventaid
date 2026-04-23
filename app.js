require('dotenv').config();
console.log('🔧 .env loaded. EMAIL_USER:', process.env.EMAIL_USER ? '✅ set' : '❌ missing');
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./database');
const authRoutes = require('./routes/auth');
const hostRoutes = require('./routes/host');
const plannerRoutes = require('./routes/planner');
const adminRoutes = require('./routes/admin');
const commonRoutes = require('./routes/common');
const paymentRoutes = require('./routes/payment');
require('dotenv').config();
const resetRoutes = require('./routes/reset');
const accountRoutes = require('./routes/account');




const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'eventaid_secret_key_change_in_production',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/', authRoutes);
app.use('/host', hostRoutes);
app.use('/planner', plannerRoutes);
app.use('/admin', adminRoutes);
app.use('/', commonRoutes);
app.use('/payment', paymentRoutes);
app.use('/', resetRoutes);
app.use('/account', accountRoutes);

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const role = req.session.user.role;
  if (role === 'host') return res.redirect('/host/dashboard');
  if (role === 'planner') return res.redirect('/planner/dashboard');
  if (role === 'admin') return res.redirect('/admin/dashboard');
  res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));