import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/montecarlo', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges, cycles = 15000, years = 15 } = req.body;
    if (!allocations.length) return res.status(400).json({ error: 'No allocations provided' });

    const totalMonths = years * 12;
    const allPaths = [];

    // Sort deposits and changes just in case
    const sortedOneTime = [...oneTimeDeposits].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedMonthly = [...monthlyChanges].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Find first deposit (either one-time or monthly change)
    const firstDepositDate = sortedOneTime.length
      ? new Date(sortedOneTime[0].date)
      : sortedMonthly.length
      ? new Date(sortedMonthly[0].date)
      : null;

    if (!firstDepositDate) return res.status(400).json({ error: 'No deposits provided' });

    for (let i = 0; i < cycles; i++) {
      let path = [];
      let value = 0;
      let monthlyAmount = 0;
      let firstDepositOccurred = false;

      for (let month = 0; month <= totalMonths; month++) {
        const currentDate = new Date(2025, 0, 1);
        currentDate.setMonth(currentDate.getMonth() + month);
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Apply monthly changes
        sortedMonthly.forEach((change) => {
          if (change.date <= dateStr) monthlyAmount = change.amount;
        });

        // Apply one-time deposits
        sortedOneTime.forEach((deposit) => {
          if (deposit.date === dateStr) value += deposit.amount;
        });

        // Apply monthly deposit if after the first deposit
        if (currentDate >= firstDepositDate) {
          value += monthlyAmount;
          firstDepositOccurred = true;
        }

        // Apply returns only after any deposit happened
        if (firstDepositOccurred) {
          allocations.forEach((asset) => {
            const monthlyReturn =
              asset.cagr / 12 + randn_bm() * (asset.volatility / Math.sqrt(12));
            value *= 1 + (monthlyReturn * (asset.allocation / 100));
          });
        }

        path.push(value);
      }

      allPaths.push(path);
    }

    // Aggregate
    const aggregated = [];
    for (let month = 0; month <= totalMonths; month++) {
      const values = allPaths.map((path) => path[month]).sort((a, b) => a - b);
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const median = values[Math.floor(values.length / 2)];
      const p10 = values[Math.floor(values.length * 0.1)];
      const p90 = values[Math.floor(values.length * 0.9)];
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
      p10: aggregated.map((r) => Math.round(r.p10)),
      p90: aggregated.map((r) => Math.round(r.p90)),
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
