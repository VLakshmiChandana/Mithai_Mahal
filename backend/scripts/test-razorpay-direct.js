const https = require('https');

const keyId = 'rzp_test_Tmz9SmPPkoO88p';
const keySecret = 'ml3sZ9oT4LuO6p0gJ6xpmbPE';
const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

const data = JSON.stringify({
  amount: 50000,
  currency: 'INR',
  receipt: 'test_rcpt_1'
});

const req = https.request({
  hostname: 'api.razorpay.com',
  port: 443,
  path: '/v1/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Authorization': `Basic ${auth}`
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', body);
  });
});

req.on('error', e => console.error('ERROR:', e));
req.write(data);
req.end();
