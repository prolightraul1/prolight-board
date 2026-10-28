# ProLight Season Board

Job board for ProLight Tallahassee's Christmas light season: crew routes, check-offs with photos, clients and jobs, a street map for scheduling, night-before run sheets, and the TCL / ShipShape payout split.

Everyone signs in by tapping their name and typing a 6-digit PIN. The owner sets each person's PIN, crew and permissions under **Office → Team**.

## What runs where (all free tiers)

| Piece | Service | What it does |
|---|---|---|
| Website | Vercel | Serves the board at `your-project.vercel.app` (or your own domain later) and runs the address lookup in `api/geocode.js` |
| Database, sign-in, photos | Supabase | Stores jobs, clients, check-offs and payouts; enforces who can see what; holds photos and videos (1 GB free) |
| Code | GitHub | Keeps the files; every change pushed here redeploys the site |

## First-time setup

### 1. Supabase (database)
1. Sign up at supabase.com and create a project. Region: **East US**. Save the database password somewhere safe.
2. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". People are added from the board instead.
3. **SQL Editor → New query**: paste all of `supabase/schema.sql`, press **Run**.
4. New query again: paste all of `seed.sql` (sent separately; it holds your customer data), press **Run**. The last lines should show clients 67, fin 67, jobs 67, log 6.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `config.js`.

### 2. GitHub (code)
1. Sign up at github.com and create a **private** repository named `prolight-board`.
2. Put these files in it (the `private/`, `export/` and `test/` folders stay out).

### 3. Vercel (website)
1. Sign up at vercel.com with **Continue with GitHub**.
2. **Add New → Project**, pick `prolight-board`, leave every setting as is, press **Deploy**.
3. Open the address Vercel shows. The first visit asks you to create the owner login (your name + a 6-digit PIN).

### 4. Add your people
**Office → Team → Add person.** Pick a preset, choose their crew, set a PIN, and give them the PIN in person or by text.

| Preset | Can do |
|---|---|
| Crew member | Check off stops and post notes, photos, video, for their own crew's jobs only |
| Crew lead | Same, and sees every crew |
| Office | Also edits jobs, clients, crews and the schedule |
| Manager | Everything, including money and people |

Prices and payouts are only ever sent to logins with **See prices, payouts and the Money tab** turned on. The database refuses them to everyone else.

## Adding your own domain later
Buy the domain (Cloudflare, Namecheap or Porkbun, about $10–15 a year). In Vercel: **Project → Settings → Domains → Add**, type the domain, and copy the two DNS records it shows into your registrar. It goes live within an hour, with HTTPS.

## Good to know
- **Install on phones:** open the site in Safari or Chrome, then Share → Add to Home Screen. It opens full screen like an app.
- **Supabase pauses idle free projects** after about a week with no visits. During the season that never happens; in the off-season, open the Supabase dashboard and press Restore if the board says it can't connect.
- **Photos and videos** are stored at unguessable addresses. Anyone holding the exact link to a photo can open it, but nobody can list or find them.
- **Map tiles** come from OpenStreetMap; addresses are looked up through the US Census geocoder, falling back to OpenStreetMap.
