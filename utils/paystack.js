const axios = require('axios');

async function createTransferRecipient(name, email, bankCode, accountNumber) {
    try {
        const response = await axios.post('https://api.paystack.co/transferrecipient', {
            type: 'nuban',
            name: name,
            email: email,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN'
        }, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        if (response.data.status) {
            return response.data.data.recipient_code;
        }
        throw new Error(response.data.message);
    } catch (error) {
        console.error('Paystack recipient error:', error.response?.data || error.message);
        throw error;
    }
}

module.exports = { createTransferRecipient };