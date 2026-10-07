// Both reports are ordinary SQL queries with one date parameter.
export const farmerReport = `
SELECT f.name AS farmer, COUNT(r.request_id)::integer AS requests,
       COALESCE(SUM(r.requested_litres), 0) AS requested_litres,
       COALESCE(SUM(a.allocated_litres), 0) AS allocated_litres
FROM farmers f
LEFT JOIN plots p ON f.farmer_id = p.farmer_id
LEFT JOIN irrigation_requests r ON p.plot_id = r.plot_id
  AND r.budget_id = (SELECT budget_id FROM daily_budgets WHERE budget_date = $1)
LEFT JOIN allocations a ON r.request_id = a.request_id
GROUP BY f.farmer_id, f.name
ORDER BY f.name;`;

export const dailyReport = `
SELECT b.budget_date, b.total_litres,
       COALESCE(SUM(a.allocated_litres), 0) AS allocated_litres,
       b.total_litres - COALESCE(SUM(a.allocated_litres), 0) AS remaining_litres
FROM daily_budgets b
LEFT JOIN irrigation_requests r ON b.budget_id = r.budget_id
LEFT JOIN allocations a ON r.request_id = a.request_id
GROUP BY b.budget_id
ORDER BY b.budget_date DESC;`;
