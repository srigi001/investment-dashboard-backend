import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/simulate', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges } = req.body;
    const cycles = 15000;
    const years = 15;
    const totalMonths = years * 12;

    if (!allocations.length) {
      return res.status(400).json({ error: 'No allocations provided' });
    }

    // Normalize allocations
    const allocationSum = allocations.reduce((sum, a) => sum + a.allocation, 0);
    if (allocationSum === 0) {
      return res.status(400).json({ error: 'Allocations sum to 0' });
    }
    const normalizedAllocations = allocations.map((a) => ({
      ...a,
      weight: a.allocation / allocationSum,
    }));

    const allPaths = [];

    for (let i = 0; i < cycles; i++) {
      let path = [];
      let value = 0;
      let monthlyAmount = 0;

      for (let month = 0; month <= totalMonths; month++) {
        const currentDate = new Date(2025, 0, 1);
        currentDate.setMonth(currentDate.getMonth() + month);
        const dateStr = currentDate.toISOString().slice(0, 10);

        // Monthly changes
        monthlyChanges.forEach((change) => {
          if (change.date <= dateStr) monthlyAmount = change.amount;
        });

        // One-time deposits
        oneTimeDeposits.forEach((deposit) => {
          if (deposit.date === dateStr) value += deposit.amount;
        });

        // Add monthly deposit
        value += monthlyAmount;

        // If no money yet, skip return simulation (avoid multiplying zero)
        if (value === 0) {
          path.push(0);
          continue;
        }

        // Apply returns for each asset
        let totalGrowth = 0;
        normalizedAllocations.forEach((asset) => {
          const monthlyReturn = (asset.cagr / 12) + (randn_bm() * (asset.volatility / Math.sqrt(12)));
          totalGrowth += monthlyReturn * asset.weight;
        });
        value *= 1 + totalGrowth;
        path.push(value);
      }

      allPaths.push(path);
    }

    // Aggregate stats
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
        percentile10: p10,
        percentile90: p90,
      });
    }

    res.json({
      mean: aggregated.map((r) => Math.round(r.mean)),
      median: aggregated.map((r) => Math.round(r.median)),
      percentile10: aggregated.map((r) => Math.round(r.percentile10)),
      percentile90: aggregated.map((r) => Math.round(r.percentile90)),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Simulation error' });
  }
});

function randn_bm() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
