import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges, cycles = 15000 } = req.body;
    if (!allocations.length) return res.status(400).json({ error: 'No allocations provided' });

    // Find the earliest deposit date across all deposits (one-time and monthly change schedules)
    const allDates = [
      ...oneTimeDeposits.map((d) => d.date),
      ...monthlyChanges.map((d) => d.date),
    ].filter(Boolean);

    if (!allDates.length) return res.status(400).json({ error: 'No deposits found' });

    const earliestDateStr = allDates.sort()[0];
    const earliestDate = new Date(earliestDateStr);
    const startYear = earliestDate.getFullYear();
    const startMonth = earliestDate.getMonth();
    const totalMonths = 180;

    const allPaths = [];

    for (let i = 0; i < cycles; i++) {
      let path = [];
      let value = 0;
      let monthlyAmount = 0;

      for (let month = 0; month <= totalMonths; month++) {
        const currentDate = new Date(startYear, startMonth + month, 1);
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Monthly deposits update
        monthlyChanges.forEach((change) => {
          if (change.date <= dateStr) monthlyAmount = change.amount;
        });

        // One-time deposits on the exact date
        oneTimeDeposits.forEach((deposit) => {
          if (deposit.date === dateStr) value += deposit.amount;
        });

        // Apply monthly deposit
        value += monthlyAmount;

        // Apply returns only if capital exists
        if (value > 0) {
          allocations.forEach((asset) => {
            const monthlyReturn =
              asset.cagr / 12 + randn_bm() * (asset.volatility / Math.sqrt(12));
            value *= 1 + (monthlyReturn * asset.allocation) / 100;
          });
        }

        path.push(value);
      }

      allPaths.push(path);
    }

    // Aggregate results
    const aggregated = [];
    for (let month = 0; month <= totalMonths; month++) {
      const monthValues = allPaths.map((path) => path[month]).sort((a, b) => a - b);
      const mean = monthValues.reduce((sum, v) => sum + v, 0) / monthValues.length;
      const median = monthValues[Math.floor(monthValues.length / 2)];
      const p10 = monthValues[Math.floor(monthValues.length * 0.1)];
      const p90 = monthValues[Math.floor(monthValues.length * 0.9)];
      aggregated.push({
        month,
        mean,
        median,
        p10,
        p90,
      });
    }

    res.json({
      months: aggregated.map((r) => r.month),
      mean: aggregated.map((r) => Math.round(r.mean)),
      median: aggregated.map((r) => Math.round(r.median)),
      percentile10: aggregated.map((r) => Math.round(r.p10)),
      percentile90: aggregated.map((r) => Math.round(r.p90)),
      simulationStartDate: earliestDateStr, // (optional) return for front-end info
    });
  } catch (e) {
    console.error(e);
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
  console.log(`Server running on port ${port}`);
});
