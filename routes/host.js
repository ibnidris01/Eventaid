const express = require('express');
const db = require('../database');
const router = express.Router();
const axios = require('axios');

function isHost(req, res, next) {
  if (req.session.user && req.session.user.role === 'host') return next();
  res.redirect('/login');
}
router.use(isHost);

router.get('/dashboard', (req, res) => {
  const userId = req.session.user.id;
  db.all('SELECT * FROM events WHERE host_id = ? ORDER BY created_at DESC', [userId], (err, events) => {
    db.all(`SELECT p.*, e.title as event_title, u.name as planner_name, 
                   p.payment_status, p.transaction_ref 
            FROM proposals p 
            JOIN events e ON p.event_id = e.id 
            JOIN users u ON p.planner_id = u.id 
            WHERE e.host_id = ?`, [userId], (err2, proposals) => {
      res.render('host-dashboard', { 
        user: req.session.user, 
        events, 
        proposals, 
        title: 'Host Dashboard',
        query: req.query
      });
    });
  });
});

router.get('/create-event', (req, res) => {
  res.render('create-event', { error: null, user: req.session.user, title: 'Create Event' });
});

router.post('/create-event', (req, res) => {
  const { title, description, event_date, location, budget } = req.body;
  const host_id = req.session.user.id;
  db.run(`INSERT INTO events (host_id, title, description, event_date, location, budget) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [host_id, title, description, event_date, location, budget],
    function(err) {
      if (err) return res.render('create-event', { error: 'Failed to create event', user: req.session.user, title: 'Create Event' });
      res.redirect('/host/dashboard');
    });
});

router.get('/event-proposals', (req, res) => {
  const userId = req.session.user.id;
  db.all(`SELECT p.*, e.title as event_title, u.name as planner_name,
                  p.payment_status, p.transaction_ref
          FROM proposals p 
          JOIN events e ON p.event_id = e.id 
          JOIN users u ON p.planner_id = u.id 
          WHERE e.host_id = ?`, [userId], (err, proposals) => {
    res.render('event-proposals-host', { 
      user: req.session.user, 
      proposals, 
      title: 'Event Proposals',
      query: req.query
    });
  });
});

router.get('/proposal/:id/:action', (req, res) => {
  const { id, action } = req.params;
  const status = action === 'accept' ? 'accepted' : 'rejected';
  db.run('UPDATE proposals SET status = ? WHERE id = ?', [status, id], (err) => {
    res.redirect('/host/event-proposals');
  });
});

// Debugging version of the proposal detail route
router.get('/proposal/:proposalId', (req, res) => {
  const { proposalId } = req.params;
  const userId = req.session.user.id;
  
  console.log(`[DEBUG] Host ID: ${userId}, Proposal ID: ${proposalId}`);
  
  // First, check if proposal exists at all
  db.get('SELECT * FROM proposals WHERE id = ?', [proposalId], (err, proposalExists) => {
    if (err) console.error('[DEBUG] Error checking proposal:', err);
    console.log('[DEBUG] Proposal exists in DB?', proposalExists ? 'Yes' : 'No');
    if (proposalExists) {
      console.log('[DEBUG] Proposal event_id:', proposalExists.event_id);
      // Check event ownership
      db.get('SELECT host_id FROM events WHERE id = ?', [proposalExists.event_id], (err2, event) => {
        if (err2) console.error(err2);
        console.log('[DEBUG] Event host_id:', event ? event.host_id : 'Not found');
        console.log('[DEBUG] Current user host_id matches?', event && event.host_id === userId);
      });
    }
  });
  
  // Now run the full query
  db.get(`SELECT p.*, p.planner_id, e.title as event_title, e.location, e.event_date,
                  u.name as planner_name, u.email as planner_email, u.phone as planner_phone, u.profile_pic
          FROM proposals p
          JOIN events e ON p.event_id = e.id
          JOIN users u ON p.planner_id = u.id
          WHERE p.id = ? AND e.host_id = ?`, [proposalId, userId], (err, proposal) => {
    if (err) {
      console.error('[DEBUG] Query error:', err);
      return res.status(500).send('Database error');
    }
    if (!proposal) {
      console.log('[DEBUG] No proposal found with the given criteria');
      return res.status(404).send('Proposal not found');
    }
    console.log('[DEBUG] Proposal found, rendering detail page');
    res.render('host-proposal-detail', { user: req.session.user, proposal });
  });
});

router.post('/delete-event/:eventId', (req, res) => {
  const { eventId } = req.params;
  const userId = req.session.user.id;
  db.get('SELECT * FROM events WHERE id = ? AND host_id = ?', [eventId, userId], (err, event) => {
    if (err || !event) return res.status(404).send('Event not found');
    db.run('DELETE FROM proposals WHERE event_id = ?', [eventId], (err) => {
      if (err) console.error(err);
      db.run('DELETE FROM events WHERE id = ?', [eventId], (err) => {
        if (err) console.error(err);
        res.redirect('/host/dashboard');
      });
    });
  });
});

router.post('/delete-proposal/:proposalId', (req, res) => {
  const { proposalId } = req.params;
  const userId = req.session.user.id;
  db.get(`SELECT p.*, e.host_id FROM proposals p 
          JOIN events e ON p.event_id = e.id 
          WHERE p.id = ? AND e.host_id = ?`, [proposalId, userId], (err, proposal) => {
    if (err || !proposal) return res.status(404).send('Proposal not found');
    db.run('DELETE FROM proposals WHERE id = ?', [proposalId], (err) => {
      if (err) console.error(err);
      res.redirect('/host/dashboard');
    });
  });
});

// Release payment to planner after event completion
router.post('/release-payment/:proposalId', async (req, res) => {
    const { proposalId } = req.params;
    const userId = req.session.user.id;

    console.log(`[RELEASE] Attempting to release proposal ${proposalId} by host ${userId}`);

    db.get(`SELECT p.*, e.event_date, e.title as event_title, u.recipient_code, u.name as planner_name, u.email as planner_email
            FROM proposals p
            JOIN events e ON p.event_id = e.id
            JOIN users u ON p.planner_id = u.id
            WHERE p.id = ? AND e.host_id = ?`, [proposalId, userId], async (err, proposal) => {
        if (err || !proposal) {
            console.error('[RELEASE] Proposal not found:', err);
            return res.status(404).send('Proposal not found');
        }
        console.log('[RELEASE] Proposal found:', { id: proposal.id, amount: proposal.amount, payment_status: proposal.payment_status, payment_released: proposal.payment_released, recipient_code: proposal.recipient_code });

        if (proposal.payment_status !== 'paid') {
            console.error('[RELEASE] Payment not completed');
            return res.status(400).send('Payment not completed yet');
        }
        if (proposal.payment_released === 1) {
            console.error('[RELEASE] Already released');
            return res.status(400).send('Payment already released');
        }
        if (!proposal.recipient_code) {
            console.error('[RELEASE] No recipient_code for planner');
            return res.status(400).send('Planner has not set up bank account');
        }

        // Optional: check event date has passed
        const today = new Date().toISOString().slice(0,10);
        if (proposal.event_date > today) {
            console.error('[RELEASE] Event date not passed');
            return res.status(400).send('Event date has not passed yet. You can release only after the event.');
        }

        const amountInKobo = proposal.amount * 100;
        const reference = 'REL_' + Date.now() + '_' + proposalId;
        console.log(`[RELEASE] Transferring ₦${proposal.amount} (${amountInKobo} kobo) to recipient ${proposal.recipient_code}, ref: ${reference}`);

        try {
            // Check Paystack balance first (optional)
            const balanceCheck = await axios.get('https://api.paystack.co/balance', {
                headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
            });
            console.log('[RELEASE] Available balance:', balanceCheck.data.data);

            const transfer = await axios.post('https://api.paystack.co/transfer', {
                source: 'balance',
                amount: amountInKobo,
                recipient: proposal.recipient_code,
                reason: `Payment for event: ${proposal.event_title}`,
                reference: reference
            }, {
                headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
            });

            console.log('[RELEASE] Transfer response:', transfer.data);

            if (transfer.data.status) {
                db.run('UPDATE proposals SET payment_released = 1 WHERE id = ?', [proposalId], (err) => {
                    if (err) console.error('[RELEASE] DB update error:', err);
                    // Send email to planner
                    const { sendPaymentReleasedEmail } = require('../utils/mailer');
                    sendPaymentReleasedEmail(proposal.planner_email, proposal.planner_name, proposal.event_title, proposal.amount);
                    res.redirect('/host/dashboard?release=success');
                });
            } else {
                console.error('[RELEASE] Transfer failed:', transfer.data.message);
                res.status(500).send('Transfer failed: ' + transfer.data.message);
            }
        } catch (error) {
            console.error('[RELEASE] Transfer error:', error.response?.data || error.message);
            res.status(500).send('Transfer error: ' + (error.response?.data?.message || error.message));
        }
    });
});

// Browse all planners (for host to see portfolios)
router.get('/browse-planners', (req, res) => {
    db.all('SELECT id, name, email, phone, profile_pic FROM users WHERE role = "planner" ORDER BY name ASC', [], (err, planners) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error loading planners');
        }
        res.render('browse-planners', { user: req.session.user, planners, title: 'Browse Planners' });
    });
});

// Show edit event form
router.get('/edit-event/:eventId', (req, res) => {
    const { eventId } = req.params;
    const userId = req.session.user.id;
    db.get('SELECT * FROM events WHERE id = ? AND host_id = ?', [eventId, userId], (err, event) => {
        if (err || !event) return res.status(404).send('Event not found');
        res.render('edit-event', { user: req.session.user, event, error: null, title: 'Edit Event' });
    });
});

// Update event host can edit changes
router.post('/edit-event/:eventId', (req, res) => {
    const { eventId } = req.params;
    const userId = req.session.user.id;
    const { title, description, event_date, location, budget } = req.body;
    db.run(`UPDATE events SET title = ?, description = ?, event_date = ?, location = ?, budget = ? WHERE id = ? AND host_id = ?`,
        [title, description, event_date, location, budget, eventId, userId], function(err) {
            if (err) {
                console.error(err);
                return res.render('edit-event', { user: req.session.user, event: req.body, error: 'Update failed', title: 'Edit Event' });
            }
            res.redirect('/host/dashboard');
        });
});
module.exports = router;