import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/montecarlo', (req, res) => {
  try {
    const { allocations, oneTimeDeposits, monthlyChanges, cycles, years } = req.body;

    if (!allocations.length) return res.status(400).json({ error: 'No allocations provided' });

    const monthlyYears = years * 12;
    const simulations = [];

    for (let i = 0; i < cycles; i++) {
      let portfolioValue = 100000;
      let monthlyAmount = 0;

      for (let month = 0; month < monthlyYears; month++) {
        const currentDate = new Date(2025, 0, 1);
        currentDate.setMonth(currentDate.getMonth() + month);

        const dateStr = currentDate.toISOString().slice(0, 10);

        monthlyChanges.forEach((change) => {
          if (change.date <= dateStr) monthlyAmount = change.amount;
        });

        portfolioValue += monthlyAmount;

        oneTimeDeposits.forEach((deposit) => {
          if (deposit.date === dateStr) portfolioValue += deposit.amount;
        });

        allocations.forEach((asset) => {
          const monthlyReturn = (asset.cagr / 12) + (randn_bm() * (asset.volatility / Math.sqrt(12)));
          portfolioValue *= 1 + (monthlyReturn * (asset.allocation / 100));
        });
      }

      simulations.push(portfolioValue);
    }

    const yearlyResults = Array.from({ length: years + 1 }, (_, y) => {
      const yearPortfolioValues = simulations.map((sim) => sim * Math.pow(1, y / years));
      yearPortfolioValues.sort((a, b) => a - b);
      const mean = yearPortfolioValues.reduce((sum, v) => sum + v, 0) / cycles;
      const median = yearPortfolioValues[Math.floor(cycles / 2)];
      const p10 = yearPortfolioValues[Math.floor(cycles * 0.1)];
      const p90 = yearPortfolioValues[Math.floor(cycles * 0.9)];

      return {
        year: y,
        mean,
        median,
        p10,
        p90
      };
    });

    res.json({
      years: yearlyResults.map((r) => r.year),
      mean: yearlyResults.map((r) => Math.round(r.mean)),
      median: yearlyResults.map((r) => Math.round(r.median)),
      p10: yearlyResults.map((r) => Math.round(r.p10)),
      p90: yearlyResults.map((r) => Math.round(r.p90))
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
