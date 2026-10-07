-- One reusable view joins the tables for the request list and reports.
CREATE OR REPLACE VIEW request_summary AS
SELECT r.request_id, b.budget_date, p.plot_id, p.plot_name, f.name AS farmer_name,
       rules.crop_stage, r.moisture_pct, r.requested_litres, r.priority,
       COALESCE(a.allocated_litres, 0) AS allocated_litres,
       CASE
           WHEN a.allocation_id IS NULL THEN 'Waiting'
           WHEN a.allocated_litres < r.requested_litres THEN 'Partial'
           ELSE 'Allocated'
       END AS status
FROM irrigation_requests r
JOIN daily_budgets b ON r.budget_id = b.budget_id
JOIN plots p ON r.plot_id = p.plot_id
JOIN farmers f ON p.farmer_id = f.farmer_id
JOIN irrigation_rules rules ON p.rule_id = rules.rule_id
LEFT JOIN allocations a ON r.request_id = a.request_id;
