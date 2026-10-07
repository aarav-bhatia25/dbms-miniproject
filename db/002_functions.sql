-- 1. TRIGGER: PostgreSQL assigns a priority when a request is inserted.
-- These moisture thresholds are sample values for the classroom demo.
CREATE OR REPLACE FUNCTION set_request_priority()
RETURNS TRIGGER AS $$
DECLARE
    threshold NUMERIC;
BEGIN
    SELECT r.moisture_threshold INTO threshold
    FROM plots p JOIN irrigation_rules r ON p.rule_id = r.rule_id
    WHERE p.plot_id = NEW.plot_id;

    IF NEW.moisture_pct < threshold - 10 THEN
        NEW.priority := 'High';
    ELSIF NEW.moisture_pct < threshold THEN
        NEW.priority := 'Medium';
    ELSE
        NEW.priority := 'Low';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS priority_before_insert ON irrigation_requests;
CREATE TRIGGER priority_before_insert
BEFORE INSERT ON irrigation_requests
FOR EACH ROW EXECUTE FUNCTION set_request_priority();

-- 2. FUNCTION: share the day's supply, highest priority first.
-- One call is one transaction; if it fails, none of its allocations are saved.
CREATE OR REPLACE FUNCTION allocate_water(selected_date DATE)
RETURNS INTEGER AS $$
DECLARE
    day_budget daily_budgets%ROWTYPE;
    request RECORD;
    water_left INTEGER;
    amount INTEGER;
    total_added INTEGER := 0;
BEGIN
    -- A second allocation call waits here until the first one finishes.
    SELECT * INTO day_budget FROM daily_budgets
    WHERE budget_date = selected_date FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Set a water budget for this date first.';
    END IF;

    SELECT day_budget.total_litres - COALESCE(SUM(a.allocated_litres), 0)
    INTO water_left
    FROM allocations a JOIN irrigation_requests r ON a.request_id = r.request_id
    WHERE r.budget_id = day_budget.budget_id;

    FOR request IN
        SELECT r.request_id, r.requested_litres,
               COALESCE(a.allocated_litres, 0) AS already_allocated
        FROM irrigation_requests r LEFT JOIN allocations a ON r.request_id = a.request_id
        WHERE r.budget_id = day_budget.budget_id
        ORDER BY CASE r.priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END,
                 r.submitted_at, r.request_id
    LOOP
        EXIT WHEN water_left = 0;
        amount := LEAST(request.requested_litres - request.already_allocated, water_left);
        IF amount > 0 THEN
            INSERT INTO allocations(request_id, allocated_litres)
            VALUES (request.request_id, amount)
            ON CONFLICT (request_id) DO UPDATE
            SET allocated_litres = allocations.allocated_litres + EXCLUDED.allocated_litres;
            water_left := water_left - amount;
            total_added := total_added + amount;
        END IF;
    END LOOP;
    RETURN total_added;
END;
$$ LANGUAGE plpgsql;
