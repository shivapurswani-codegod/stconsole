# ST Console v3 — setup guide (about 20 minutes)

## 1. Supabase (the database)
1. supabase.com → **New project** (name: ST Console, save the database password).
2. Left sidebar → **SQL Editor** → **New query** → open `supabase/schema.sql` from this folder, copy ALL of it, paste, click **Run**. You should see "Success".
3. Left sidebar → **Authentication** → **Users** → **Add user** → **Create new user**: your email + password, keep "Auto Confirm User" ticked.
4. Gear icon (**Project Settings**) → **API Keys**. Copy two things:
   - **Project URL** — only the base address, e.g. `https://abcd1234.supabase.co` (NO `/rest/v1/` on the end)
   - the **anon / publishable** key (a long code). If you see tabs, the anon key is under "Legacy API Keys"; a key starting `sb_publishable_` also works.

## 2. GitHub (where the code lives)
New **private** repository → **uploading an existing file** → drag in everything inside this folder (the files and folders, not the folder itself) → **Commit changes**.

## 3. Vercel (the live website)
1. vercel.com → **Add New → Project** → import the repository.
2. Add two **Environment Variables** (mark both as type **Config**, not Secret):
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon/publishable key
3. **Deploy**. Open the link it gives you and sign in with the user from step 1.3.

## 4. First-time use
- **Settings**: enter weekly fee, payment link and bank details, and the starting kitty balance. Add holidays for the coming months **before** the month starts.
- **Colours/signs, everywhere:** a **negative** number in **red** = the member owes that amount; a **positive** number in **green** = the member is in credit.
- **Members**: use "Download upload template", fill in your list and bulk-upload. **Social Fee** is always an amount the member owes and is posted to the month selected on the page (upload again to correct it; blank = no change, 0 = remove). **Opening Meeting Fee Due**: negative = owes, positive = in credit (new members only). Tick the boxes on the left of the table to delete several members at once (you'll be asked to confirm). Monthly meeting fees are posted automatically the first time the console is opened in each new month.

## Updating later
GitHub → open the file → pencil icon → paste the new content → Commit. Vercel redeploys by itself in about a minute.

## If something looks wrong
A red message at the top of the screen means a save or load failed and tells you why — send it to me as-is. "Couldn't load the console" with a Try-again button means the database could not be reached (usually a mistyped URL or key in Vercel; fix it under Project → Settings → Environment Variables, then Deployments → Redeploy).


## Updating from v2 / v2.1 to v3
No database changes are needed. Replace the files on GitHub (delete the old `src` folder first, so the removed Renewals page goes too) and Vercel redeploys on its own. An old `renewal_members` table in Supabase is simply no longer used and is harmless.
