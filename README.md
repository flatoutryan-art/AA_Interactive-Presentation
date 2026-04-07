# Apollo Africa — Energy Proposal Engine

A production-grade SaaS proposal platform built with **Next.js 14**, **Supabase**, and **Tailwind CSS**. Generates unique, interactive, client-specific energy proposals without redeployment.

---

## Architecture

```
proposals.apolloafrica.co.za/
├── /admin           → Password-protected sales form (Part A)
└── /[slug]          → Client proposal view (Part B)
```

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Framework  | Next.js 14 (App Router)             |
| Database   | Supabase (PostgreSQL)               |
| Styling    | Tailwind CSS + CSS variables        |
| Charts     | Recharts                            |
| Hosting    | Vercel                              |
| Fonts      | Barlow Condensed · DM Sans · JetBrains Mono |

---

## Brand Identity

| Token         | Value     | Usage                          |
|---------------|-----------|--------------------------------|
| Apollo Green  | `#10B981` | Primary accent, CTAs, data     |
| Apollo Mint   | `#34D399` | Secondary accent, highlights   |
| Deep Forest   | `#0D1B14` | Page background                |
| Forest        | `#0F2318` | Card backgrounds               |
| Border        | `#1E4D30` | Dividers, borders              |
| Gold          | `#C9A84C` | Logo mark, Reunert accent      |

---

## Quickstart

### 1. Clone & Install
```bash
git clone <repo>
cd apollo-proposal-engine
npm install
```

### 2. Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql` — this creates the `proposals` table and seeds Steyn City data
3. Copy your **Project URL** and **anon key** from *Settings → API*

### 3. Environment Variables
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and admin password
```

### 4. Run Locally
```bash
npm run dev
# → http://localhost:3000/steyn-city  (seeded client)
# → http://localhost:3000/admin       (proposal generator)
```

### 5. Deploy to Vercel
```bash
npx vercel
# Add environment variables in Vercel dashboard
# Set custom domain: proposals.apolloafrica.co.za
```

---

## File Structure

```
apollo-proposal-engine/
├── app/
│   ├── layout.tsx              # Root layout with Google Fonts
│   ├── globals.css             # CSS variables + Tailwind base
│   ├── admin/
│   │   └── page.tsx            # Part A: Sales admin form
│   └── [slug]/
│       └── page.tsx            # Part B: Client proposal view
├── lib/
│   ├── supabaseClient.ts       # Supabase client + Proposal type
│   └── ThemeContext.tsx        # Apollo brand tokens
├── supabase/
│   └── schema.sql              # DB schema + Steyn City seed
├── tailwind.config.js          # Apollo brand Tailwind tokens
├── .env.local.example
└── package.json
```

---

## Key Logic

### GHG Savings Formula
```typescript
const ghgSavings = contract_mwh * 0.94; // Tons CO₂e/yr
```

### Savings Trajectory Algorithm
The `buildSavingsTrajectory()` function in `[slug]/page.tsx` computes year-by-year savings by:
- Starting with the selected term's `activeTariff` (R/kWh)
- Escalating Apollo tariff at `escalation_cpi` % per year
- Escalating Eskom WEPS at `eskom_escalation` % per year
- Annual saving = `(eskomTariff - apolloTariff) × contractMwh × 1000 / 1,000,000` [Mill ZAR]

### TOU Tariff Data (from PDF — 1 April 2025)

| Period             | 5yr   | 10yr  | 15yr  | Eskom |
|--------------------|-------|-------|-------|-------|
| Weighted Average   | 1.43  | 1.41  | 1.34  | 1.49  |
| High Season Peak   | 5.20  | 5.13  | 4.88  | 5.40  |
| High Season Std    | 1.28  | 1.26  | 1.17  | 1.35  |
| Low Season Peak    | 2.16  | 2.13  | 2.03  | 2.24  |

### Dynamic Route Pattern
Supabase is queried by `slug` on every page load. The sticky Term Selector (5/10/15yr) updates all charts, tables, and stats client-side via React state — **zero page reloads**.

---

## Generating a New Proposal

1. Visit `/admin`
2. Enter the admin password (set in `.env.local`)
3. Fill in the client's details including:
   - Monthly supply & load profiles (MWh)
   - TOU tariffs per term
   - Cumulative savings estimates
4. Click **Generate Proposal**
5. Share the generated URL: `proposals.apolloafrica.co.za/[slug]`

---

## Supabase Row-Level Security

- **Anyone** can `SELECT` (public proposal viewing)
- Only **authenticated users** can `INSERT`/`UPDATE`
- The admin form uses the anon key but you can upgrade to a service-role key in a server action for production

---

## Customisation

To add a new client-specific TOU tariff table (e.g. COD 2028 data), extend the `Proposal` type in `supabaseClient.ts` and add the corresponding columns in `schema.sql`.

---

*Commercial in confidence. Apollo Africa — a Reunert company. NERSA/TRD09/2024.*
