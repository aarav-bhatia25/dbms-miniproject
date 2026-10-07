-- Small synthetic dataset; setup loads this only into an empty database.
INSERT INTO farmers(name, village) VALUES
('Sanjay Patil', 'Walwa'), ('Sunita Jadhav', 'Islampur'),
('Vikram Shinde', 'Ashta'), ('Meena Deshmukh', 'Walwa');

INSERT INTO irrigation_rules(crop_stage, moisture_threshold) VALUES
('Establishment', 35), ('Tillering', 40), ('Grand growth', 45), ('Maturity', 30);

INSERT INTO plots(farmer_id, plot_name, area_ha, rule_id) VALUES
(1, 'East Field', 2.0, 3), (2, 'North Field', 1.5, 2),
(3, 'Canal Field', 2.5, 3), (4, 'South Field', 1.0, 4);

INSERT INTO daily_budgets(budget_date, total_litres) VALUES (CURRENT_DATE, 100000);

-- 150,000 L requested against 100,000 L available.
-- Expected allocation: 40,000 + 35,000 + 25,000 + 0 litres.
INSERT INTO irrigation_requests(plot_id, budget_id, moisture_pct, requested_litres) VALUES
(1, 1, 20, 40000), (2, 1, 22, 35000), (3, 1, 40, 45000), (4, 1, 38, 30000);
