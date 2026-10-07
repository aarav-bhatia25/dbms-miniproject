# CaneFlow

A second-year DBMS mini project: **Smart Irrigation Management System for Sugarcane Cultivation**.

A group of farmers shares a daily water supply. Farmers request water for their plots. PostgreSQL assigns High, Medium or Low priority from soil moisture, then allocates the available water in that order.

## Run

Requirements: Node.js 22.12+, npm and Docker Desktop.

```sh
npm install
cp .env.example .env
npm run db:up
npm run db:setup
npm run dev
```

Open **http://127.0.0.1:5173**. PostgreSQL runs on port **55432**; the API uses **3017**.

The simplified database is called `caneflow_simple`. Setup creates it if needed and preserves existing records when rerun. The previous version's `caneflow` database is untouched. If you already have a `.env`, update its `DATABASE_URL` to match `.env.example`.

## Three screens

1. **Water allocation:** set the daily budget, add requests, allocate water and remove unallocated requests.
2. **Farmers & plots:** register farmers and their sugarcane fields.
3. **Reports:** water allocated per farmer and the daily water summary. Expand “Show SQL query” to see the joins and GROUP BY.

## Six tables

| Table                 | Stores                                                |
| --------------------- | ----------------------------------------------------- |
| `farmers`             | Farmer name and village                               |
| `irrigation_rules`    | Crop stage and moisture threshold                     |
| `plots`               | Farmer, field name, area and crop stage rule          |
| `daily_budgets`       | Date and total water supply                           |
| `irrigation_requests` | Plot, budget, moisture, requested litres and priority |
| `allocations`         | Litres assigned to each request                       |

There is one priority trigger, one allocation function and one joined view. See [DBMS.md](DBMS.md) for the ER diagram and explanation.

## A short demo

The sample date has **100,000 L available** and **150,000 L requested**:

| Farmer         | Priority | Requested | Allocated after running |
| -------------- | -------- | --------: | ----------------------: |
| Sanjay Patil   | High     |  40,000 L |                40,000 L |
| Sunita Jadhav  | High     |  35,000 L |                35,000 L |
| Vikram Shinde  | Medium   |  45,000 L |                25,000 L |
| Meena Deshmukh | Low      |  30,000 L |                     0 L |

1. Open **Water allocation** and explain the four requests.
2. Click **Allocate water**. Show that only the available 100,000 L was allocated.
3. Open **Reports** and expand a SQL query.
4. For another demonstration, select a new date, set its budget and add requests.

Sample data uses the setup date. Select that date if you return on a later day.

## Read the code in this order

```text
1. db/001_schema.sql       Six tables and their relationships
2. db/002_functions.sql    Priority trigger and allocation function
3. db/003_views.sql        Joined request view
4. db/004_seed.sql         Four farmers and sample requests
5. server/app.js           API endpoints and basic SQL operations
6. src/pages/              One React component per screen
```

## Checks

```sh
npm test
npm run build
```

Browser checks, after building:

```sh
npx playwright install chromium
npm run test:ui
```

Tests use separate temporary databases. They do not change the demo records.

This is a localhost classroom demo. Moisture thresholds are illustrative, and allocations represent assigned water, not measured consumption. It has no user login or physical sensor integration. The daily budget becomes fixed once any water is allocated. Keeping these boundaries makes the project small enough to explain clearly.
