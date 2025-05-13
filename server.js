import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges, cycles = 15000, years = 15 } = req.body;
    if (!allocations.length) return res.status(400).json({ error: 'No allocations provided' });

    const totalMonths = years * 12;
    const allPaths = [];

    // Detect earliest deposit date (one-time or monthly change)
    const earliestOneTime = oneTimeDeposits.length
      ? oneTimeDeposits.reduce((min, d) => (d.date < min ? d.date : min), oneTimeDeposits[0].date)
      : null;
    const earliestMonthly = monthlyChanges.length
      ? monthlyChanges.reduce((min, d) => (d.date < min ? d.date : min), monthlyChanges[0].date)
      : null;
    const earliestDate = [earliestOneTime, earliestMonthly].filter(Boolean).sort()[0];

    for (let i = 0; i < cycles; i++) {
      let path = [];
      let value = 0;
      let monthlyAmount = 0;
      let depositAdded = false;

      for (let month = 0; month <= totalMonths; month++) {
        const currentDate = new Date(2025, 0, 1);
        currentDate.setMonth(currentDate.getMonth() + month);
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Monthly deposit changes
        monthlyChanges.forEach((change) => {
          if (change.date <= dateStr) monthlyAmount = change.amount;
        });

        // One-time deposits (trigger only once per deposit date)
        oneTimeDeposits.forEach((deposit) => {
          if (deposit.date === dateStr) {
            value += deposit.amount;
            depositAdded = true;
          }
        });

        // For safety: If the earliest deposit date has passed but no deposit happened yet, add it
        if (!depositAdded && earliestDate && dateStr >= earliestDate) {
          oneTimeDeposits
            .filter((d) => d.date === earliestDate)
            .forEach((d) => {
              value += d.amount;
            });
          depositAdded = true;
        }

        // Add monthly deposit
        value += monthlyAmount;

        // Apply returns only if value > 0
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
