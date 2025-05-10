import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

const API_KEY = ' 681fb1c30c56f6.58885722'; // Replace this before deploying

app.get('/api/price-history', async (req, res) => {
  const { symbol, from, to } = req.query;

  if (!symbol || !from || !to) {
    return res.status(400).json({ error: 'Missing required query params' });
  }

  try {
    const url = `https://eodhistoricaldata.com/api/eod/${symbol}?api_token=${API_KEY}&from=${from}&to=${to}&period=d`;
    const { data } = await axios.get(url);
    const prices = data
      .reverse()
      .map(d => parseFloat(d.close))
      .filter(Boolean);
    res.json({ symbol, prices });
  } catch (err) {
  console.error('EOD API error:', err.response?.data || err.message || err);
  res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

