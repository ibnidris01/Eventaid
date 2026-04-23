const nodemailer = require('nodemailer');

// TEMPORARY HARDCODE – REMOVE AFTER .env IS FIXED
const EMAIL_USER = 'arabiywebtech@gmail.com';
const EMAIL_PASS = 'fjatyswurpiquhos';

console.log('📧 [mailer] Using hardcoded Gmail credentials');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email transporter error:', error.message);
    } else {
        console.log('✅ Gmail ready – email service active');
    }
});

async function sendPaymentNotification(plannerEmail, plannerName, eventTitle, amount, hostName) {
    const mailOptions = {
        from: `"EventAid" <${EMAIL_USER}>`,
        to: plannerEmail,
        subject: `💰 Payment Received for "${eventTitle}"`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>Payment Confirmation</h2>
                <p>Dear ${plannerName},</p>
                <p>Great news! <strong>${hostName}</strong> has successfully paid <strong>₦${amount}</strong> for your proposal on <strong>"${eventTitle}"</strong>.</p>
                <p>The funds will be settled to your bank account according to your payout schedule.</p>
                <p>You can now proceed with event planning.</p>
                <br>
                <p>Thank you for using EventAid!</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Payment email sent to ${plannerEmail}`);
    } catch (error) {
        console.error('❌ Payment email failed:', error.message);
    }
}

async function sendPasswordResetEmail(email, resetLink) {
    const mailOptions = {
        from: `"EventAid" <${EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2>Reset Your Password</h2>
                <p>You requested a password reset. Click the link below to set a new password:</p>
                <a href="${resetLink}" style="display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link expires in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <br>
                <p>EventAid Team</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ Reset email sent to ${email}`);
    } catch (error) {
        console.error('❌ Reset email failed:', error.message);
    }
}

async function sendContactEmail(senderName, senderEmail, message) {
    const html = `
        <h3>New Contact Message from ${senderName}</h3>
        <p><strong>From:</strong> ${senderEmail}</p>
        <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
    `;
    await sendEmail(process.env.BREVO_EMAIL, 'EventAid Contact Form', html);
}
async function sendPaymentReleasedEmail(plannerEmail, plannerName, eventTitle, amount) {
    const html = `<h2>Payment Released!</h2><p>Dear ${plannerName},</p><p>The host has released ₦${amount} for your work on "${eventTitle}". Funds will arrive in your bank account shortly.</p>`;
    await sendEmail(plannerEmail, 'Payment Released by Host', html);
}
// Export it
module.exports = { sendPaymentNotification, sendPasswordResetEmail };