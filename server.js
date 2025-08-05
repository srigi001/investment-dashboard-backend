// Updated server.js for Render deployment

import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';

const app = express();
app.use(cors());
app.use(express.json());

// Google Sheets API setup with environment variable support
let sheets = null;

try {
  // Try to use environment variables first (for Render deployment)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API initialized with environment variables');
  } else {
    // Fallback to key file (for local development)
    const auth = new google.auth.GoogleAuth({
      keyFile: './google-credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    sheets = google.sheets({ version: 'v4', auth });
    console.log('✅ Google Sheets API initialized with key file');
  }
} catch (error) {
  console.warn('⚠️ Google Sheets API not available:', error.message);
  sheets = null;
}

// Google Sheets endpoint
app.post('/api/google-sheets', async (req, res) => {
  try {
    if (!sheets) {
      return res.status(500).json({ 
        error: 'Google Sheets API not configured',
        details: 'Please set up Google service account credentials'
      });
    }

    const { spreadsheetId, range = 'Sheet1!A:Z' } = req.body;

    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Spreadsheet ID is required' });
    }

    console.log(`📊 Fetching Google Sheets data: ${spreadsheetId}, range: ${range}`);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    console.log(`✅ Retrieved ${rows.length} rows from Google Sheets`);

    res.json({
      success: true,
      rows,
      spreadsheetId,
      range
    });

  } catch (error) {
    console.error('❌ Google Sheets API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Google Sheets data',
      details: error.message 
    });
  }
});

// Your existing simulation endpoint
app.post('/api/simulate', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges, cycles = 15000, years = 15 } = req.body;

    if (!allocations.length) return res.status(400).json({ error: 'No allocations provided' });

    // Determine simulation start date from first deposit/change
    const allDates = [
      ...oneTimeDeposits.map((d) => d.date),
      ...monthlyChanges.map((d) => d.date),
    ].sort();

    const firstDepositDateStr = allDates.length > 0 ? allDates[0] : '2025-01-01';
    const firstDepositDate = new Date(firstDepositDateStr);
    const totalMonths = years * 12;
    const allPaths = [];

    for (let i = 0; i < cycles; i++) {
      let path = [];
      let value = 0;
      let monthlyAmount = 0;

      for (let month = 0; month <= totalMonths; month++) {
        const currentDate = new Date(firstDepositDate);
        currentDate.setMonth(currentDate.getMonth() + month);
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Update monthly deposit if applicable
        monthlyChanges.forEach((change) => {
          if (change.date <= dateStr) {
            monthlyAmount = change.amount;
          }
        });

        // Apply one-time deposits
        oneTimeDeposits.forEach((deposit) => {
          if (deposit.date === dateStr) {
            value += deposit.amount;
          }
        });

        // Apply monthly deposits
        if (monthlyAmount > 0) value += monthlyAmount;

        // Store current value before compounding
        let baseValue = value;

        // Apply asset returns on previous value (start from month 1)
        if (month > 0 && baseValue > 0) {
          allocations.forEach((asset) => {
            const monthlyReturn =
              asset.cagr / 12 + randn_bm() * (asset.volatility / Math.sqrt(12));
            baseValue *= 1 + monthlyReturn * (asset.allocation / 100);
          });
          value = baseValue;
        }

        path.push(value);
      }

      allPaths.push(path);
    }

    // Aggregate paths
    const aggregated = [];
    for (let month = 0; month <= totalMonths; month++) {
      const monthValues = allPaths.map((path) => path[month]).sort((a, b) => a - b);
      const mean = monthValues.reduce((sum, v) => sum + v, 0) / monthValues.length;
      const median = monthValues[Math.floor(monthValues.length / 2)];
      const p10 = monthValues[Math.floor(monthValues.length * 0.1)];
      const p90 = monthValues[Math.floor(monthValues.length * 0.9)];
      aggregated.push({
        month,
        mean: isNaN(mean) ? 0 : mean,
        median: isNaN(median) ? 0 : median,
        p10: isNaN(p10) ? 0 : p10,
        p90: isNaN(p90) ? 0 : p90,
      });
    }

    res.json({
      simulationStartDate: firstDepositDateStr,
      months: aggregated.map((r) => r.month),
      mean: aggregated.map((r) => Math.round(r.mean)),
      median: aggregated.map((r) => Math.round(r.median)),
      percentile10: aggregated.map((r) => Math.round(r.p10)),
      percentile90: aggregated.map((r) => Math.round(r.p90)),
    });
  } catch (e) {
    console.error('Simulation error:', e);
    res.status(500).json({ error: 'Simulation error' });
  }
});

function randn_bm() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
}); 
