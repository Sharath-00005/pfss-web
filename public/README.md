# Public Force Security Services: HR, payroll, compliance and billing

A website with staff sign-in. Nobody can see any data without an account, and each account has a role.

| Role | Can do |
|---|---|
| admin | Everything, including settings and staff roles |
| manager | Read and write all records except settings (HR, payroll, accounts) |
| viewer | Read only |
| disabled | Nothing |

Files:

- `public/`: the website. Only this folder is published.
  - `index.html`: the app
  - `pfss-backend.js`: sign-in screen, database and file storage connection
  - `config.js`: your Supabase address and key (you fill this in)
  - `_headers`: security headers for Cloudflare Pages and Netlify
- `public/ratecard/`: the **Rate Card mobile app** (installs on a phone, see below)
- `supabase/functions/send-ratecard/index.ts`: the small server function that sends email from your company addresses
- `supabase/schema.sql`: tables and access rules (run in Supabase, never published)
- `supabase/seed_from_claude.sql`: your current data, to import once. Contains personal data. Never upload it to GitHub or the host.

## Set up (about 30 minutes)

### 1. Create the database
1. Sign up at supabase.com and create a project. Choose the **Mumbai (ap-south-1)** region and a long database password.
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, run it.
3. Optional, to bring over what is in the Claude version: paste `supabase/seed_from_claude.sql` into a new query and run it. It holds 2 employees, 1 client, 1 invoice, attendance, payroll runs, licences and settings. Uploaded photos and document copies are not included. Approvers must be added again.

### 2. Lock down sign-up (important)
1. **Authentication > Sign In / Providers > Email**: switch **off** "Allow new users to sign up". Without this, anyone could create an account.
2. Set a minimum password length of 10 or more under the same area.
3. **Authentication > Users > Add user > Create new user**: enter an email and password for yourself and tick "Auto Confirm User". Repeat for each staff member.
4. Make yourself admin. In the SQL Editor run:
   `update public.profiles set role = 'admin' where email = 'YOUR-EMAIL';`
   Other people start as viewer. Promote HR and accounts staff:
   `update public.profiles set role = 'manager' where email = 'their-email';`
   To remove someone's access: `update public.profiles set role = 'disabled' where email = '...';`

### 3. Connect the app
1. **Project Settings > API**: copy the **Project URL** and the **anon public** key into `public/config.js`. Never use the `service_role` key.
2. Test on your computer: open a terminal in the `public` folder and run `python3 -m http.server 8000`, open http://localhost:8000, sign in.

### 4. Put it on GitHub and publish
1. Create a **private** repository and push this folder:
   ```
   git init
   git add .
   git commit -m "Public Force system"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/pfss-web.git
   git push -u origin main
   ```
   `supabase/seed_from_claude.sql` is listed in `.gitignore`, so it will not be uploaded.
2. Publish with **Cloudflare Pages** or **Netlify** (both free and work with private repos): connect the repository, leave the build command empty and set the **build output directory to `public`**. Anything outside `public` is not served to visitors.
3. Add your domain in the host's settings if you want one (for example `app.publicforcesecurity.com`).
4. Back in Supabase: **Authentication > URL Configuration**: set **Site URL** to your live address and add it under Redirect URLs. This makes the "Forgot password" email link work.

GitHub Pages also works, but private repositories need a paid GitHub plan, and a public repository shows your code to everyone.

## Things to know
- **The login screen is not the protection.** The access rules in `schema.sql` are. Do not skip step 1.2.
- **Free Supabase projects pause after about a week without use and have no backups.** For real payroll data use a paid plan with daily backups, and check current limits on supabase.com/pricing.
- **Personal data.** The app stores Aadhaar numbers, bank details and ID copies. Keep admin accounts few, use strong unique passwords, and remove access for people who leave. Obligations under the Digital Personal Data Protection Act apply to you as the data holder.
- **Sessions end after 30 idle minutes** (change `IDLE_MINUTES` in `config.js`).
- **Employee documents** are stored privately and open through links that expire after 2 minutes.
- **Not included yet:** two-step verification (Supabase supports it; the app does not ask for it yet), a screen for managing staff accounts (use the SQL above), and an activity log screen.
- The Claude-hosted copy keeps its own separate data. Once you switch, use only one of them.


## Rate Card mobile app

Open `https://YOUR-SITE/ratecard/` on a phone and sign in with the same login as the main system.

**Install it on the phone**
- Android (Chrome): menu, then "Install app" or "Add to Home screen".
- iPhone (Safari): Share, then "Add to Home Screen".

**Using it**
1. **New card:** enter the client, the title and the wages for each role (Basic, D.A., Special, Washing, Uniform). The Grand Total per person updates as you type. Rates default to the latest card (PF 13, ESIC 3.25, Bonus 8.33, Service 7, GST 18); change them under "Rates and options".
2. **Preview and send:** shows the 14-line rate card. Then tap **Email to client**, **Share** (WhatsApp or any app) or **Download PDF**. The PDF has your letterhead and logo, the client's name and the date.
3. **Save this card:** saves into the same list as the main system's Rate Card tab. Open it again from the **Saved** tab to change it or send it again.

Tick "Show employee deductions and in-hand salary" off for a client copy with only the 14 billing lines.

## Email from the app (one-time setup)

The app builds the PDF on the phone and a small server function sends it from the company address you choose (info@, accounts@, hr@ and so on). Your email key stays on the server and is never in the app.

1. **Resend:** if you already set up Resend for the payroll emails, reuse it. Otherwise create an account at resend.com, add and verify your domain `publicforcesecurity.com` (add the DNS records it shows), and create an API key. Addresses can only send once the domain is verified.
2. **Deploy the function:** Supabase, **Edge Functions**, **Deploy a new function**, **Via Editor**. Name it exactly `send-ratecard`. Replace the sample code with the contents of `supabase/functions/send-ratecard/index.ts`. Leave "Verify JWT" on. Click **Deploy**.
3. **Add the secret:** Supabase, **Edge Functions**, **Secrets**: add `RESEND_API_KEY` with your key (it starts with `re_`).
4. **Choose the sending addresses (optional):** add a secret `ALLOWED_SENDERS`. The default is info@, accounts@ and hr@publicforcesecurity.com. To change or add:
   `info@publicforcesecurity.com|Public Force Security Services;accounts@publicforcesecurity.com|Public Force Accounts;hr@publicforcesecurity.com|Public Force HR;sales@publicforcesecurity.com|Public Force Sales`
   (each address, then `|`, then the name clients see, separated by `;`).
5. **Test:** in the app, make a card, tap Email to client, put your own address in To, and send.

**Good to know**
- Only people with the **admin** or **manager** role can send. Viewers can still share or download the PDF.
- Limits: 5 recipients and 5 CC addresses per email, and 60 emails per person per day (change with a `DAILY_LIMIT` secret).
- "Keep a copy in the sending mailbox" sends a BCC to the sending address, because mail sent this way does not appear in a Sent folder. Replies go to the sending address.
- Every email is logged (who sent it, from which address, to whom, subject). In Supabase, open **Table Editor**, table `documents`, and filter `collection` = `emailLog`.
- The mailboxes (info@, accounts@, hr@) must exist with your mail provider to receive replies and the BCC copy.
- If the function is not deployed yet, the app says so and offers **Share** instead.
