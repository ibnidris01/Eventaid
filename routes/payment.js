const express = require('express');
const axios = require('axios');
const router = express.Router();
const db = require('../database');
const { sendPaymentNotification } = require('../utils/mailer'); // only this

// Middleware to check user is logged in (host)
function isAuthenticated(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// Initialize payment (host pays for a proposal)
router.post('/initialize/:proposalId', isAuthenticated, async (req, res) => {
    const { proposalId } = req.params;
    const userId = req.session.user.id;

    db.get(`SELECT p.*, e.host_id, e.title, u.name as planner_name, u.email as planner_email
            FROM proposals p
            JOIN events e ON p.event_id = e.id
            JOIN users u ON p.planner_id = u.id
            WHERE p.id = ?`, [proposalId], async (err, proposal) => {
        if (err || !proposal) return res.status(404).json({ error: 'Proposal not found' });
        if (proposal.host_id !== userId) return res.status(403).json({ error: 'Not your event' });
        if (proposal.status !== 'accepted') return res.status(400).json({ error: 'Proposal not accepted yet' });
        if (proposal.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });

        const amountInKobo = proposal.amount * 100; // ✅ define here
        const callbackUrl = `${req.protocol}://${req.get('host')}/payment/verify/${proposalId}`;

        try {
            const response = await axios.post('https://api.paystack.co/transaction/initialize', {
                email: req.session.user.email,
                amount: amountInKobo,
                metadata: {
                    proposal_id: proposalId,
                    host_id: userId,
                    event_title: proposal.title
                },
                callback_url: callbackUrl
            }, {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.data.status) {
                res.json({ authorization_url: response.data.data.authorization_url, reference: response.data.data.reference });
            } else {
                console.error('Paystack error:', response.data.message);
                res.status(500).json({ error: response.data.message || 'Payment initialization failed' });
            }
        } catch (error) {
            console.error('Paystack request error:', error.response?.data || error.message);
            res.status(500).json({ error: 'Payment initialization failed' });
        }
    });
});
// Verify payment after redirect
router.get('/verify/:proposalId', isAuthenticated, async (req, res) => {
    const { proposalId } = req.params;
    const { reference } = req.query;

    if (!reference) return res.redirect('/host/dashboard?payment=failed');

    try {
        const verify = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
        });

        const paymentData = verify.data.data;
        if (paymentData.status === 'success') {
            db.run(`UPDATE proposals SET payment_status = 'paid', transaction_ref = ? WHERE id = ?`, 
                [reference, proposalId], function(err) {
                    if (err) console.error(err);
                    
                    // Fetch planner details to send notification
                    db.get(`SELECT u.email, u.name as planner_name, e.title as event_title, host.name as host_name, p.amount
                            FROM proposals p
                            JOIN users u ON p.planner_id = u.id
                            JOIN events e ON p.event_id = e.id
                            JOIN users host ON e.host_id = host.id
                            WHERE p.id = ?`, [proposalId], (err2, plannerInfo) => {
                        if (!err2 && plannerInfo) {
                            sendPaymentNotification(
                                plannerInfo.email,
                                plannerInfo.planner_name,
                                plannerInfo.event_title,
                                plannerInfo.amount,
                                plannerInfo.host_name
                            ).catch(e => console.error('Email error:', e));
                        }
                        res.redirect('/host/dashboard?payment=success');
                    });
                });
        } else {
            res.redirect('/host/dashboard?payment=failed');
        }
    } catch (error) {
        console.error('Verification error:', error);
        res.redirect('/host/dashboard?payment=failed');
    }
});

// Webhook
router.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const event = req.body;
    if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const proposalId = event.data.metadata?.proposal_id;
        if (proposalId) {
            db.run(`UPDATE proposals SET payment_status = 'paid', transaction_ref = ? WHERE id = ?`, [reference, proposalId]);
        }
    }
    res.sendStatus(200);
});

module.exports = router;