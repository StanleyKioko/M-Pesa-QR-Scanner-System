require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { triggerSTKPush, handleCallback } = require('./controllers/daraja');
const { verifyToken } = require('./middlewares/auth');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/daraja/scan-qr', verifyToken, triggerSTKPush);
app.post('/daraja/callback', handleCallback);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));