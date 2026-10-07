-- Six tables for a small, local DBMS mini project.

CREATE TABLE IF NOT EXISTS farmers (
    farmer_id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    village VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS irrigation_rules (
    rule_id SERIAL PRIMARY KEY,
    crop_stage VARCHAR(30) NOT NULL UNIQUE,
    moisture_threshold NUMERIC(5,2) NOT NULL CHECK (moisture_threshold BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS plots (
    plot_id SERIAL PRIMARY KEY,
    farmer_id INTEGER NOT NULL REFERENCES farmers(farmer_id),
    plot_name VARCHAR(80) NOT NULL,
    area_ha NUMERIC(6,2) NOT NULL CHECK (area_ha > 0),
    rule_id INTEGER NOT NULL REFERENCES irrigation_rules(rule_id)
);

CREATE TABLE IF NOT EXISTS daily_budgets (
    budget_id SERIAL PRIMARY KEY,
    budget_date DATE NOT NULL UNIQUE,
    total_litres INTEGER NOT NULL CHECK (total_litres > 0)
);

CREATE TABLE IF NOT EXISTS irrigation_requests (
    request_id SERIAL PRIMARY KEY,
    plot_id INTEGER NOT NULL REFERENCES plots(plot_id),
    budget_id INTEGER NOT NULL REFERENCES daily_budgets(budget_id),
    moisture_pct NUMERIC(5,2) NOT NULL CHECK (moisture_pct BETWEEN 0 AND 100),
    requested_litres INTEGER NOT NULL CHECK (requested_litres > 0),
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (plot_id, budget_id)
);

CREATE TABLE IF NOT EXISTS allocations (
    allocation_id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL UNIQUE REFERENCES irrigation_requests(request_id),
    allocated_litres INTEGER NOT NULL CHECK (allocated_litres > 0)
);
