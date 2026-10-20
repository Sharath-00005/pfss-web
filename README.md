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


### Option B: send the email from a Cloudflare Worker instead of Supabase

Use this if you would rather not use a Supabase Edge Function. Your login and saved data stay in Supabase. Only the email sender moves to Cloudflare, which already hosts your site. Do this **instead of** steps 2 to 4 above (Resend setup in step 1 is still needed).

1. **Create the Worker:** Cloudflare dashboard, **Workers & Pages**, **Create**, start with **Hello World**, name it `pfss-email`, then **Deploy**. Click **Edit code**, delete everything, paste the contents of `worker/send-ratecard.js`, and **Deploy**.
2. **Add its settings:** open the Worker, **Settings**, **Variables and Secrets**, and add:
   - `RESEND_API_KEY` as a **Secret**: your Resend key (starts with `re_`).
   - `SUPABASE_URL` as **Text**: your Supabase project address (the same one in `config.js`).
   - `SUPABASE_ANON_KEY` as **Text**: the same anon key that is in `config.js`.
   - Optional: `ALLOWED_SENDERS` (see above) and `ALLOWED_ORIGIN` (your site address, if it is not `https://pfss-web.sharath9480.workers.dev`).
3. **Tell the app where it is:** in `public/config.js`, add a line with the Worker's address, for example
   `EMAIL_API_URL: "https://pfss-email.sharath9480.workers.dev",`
4. Upload the new `public/ratecard/index.html` and `config.js` to GitHub. The app now sends through the Worker.

The Worker checks each person's login with Supabase, only lets admins and managers send, only allows your sending addresses and your website, and keeps the same daily limit and log as the Supabase version. It needs no Supabase admin key.


## Standard cost sheet, minimum wages and pay structure

**The rate card.** New rate cards start as the **cost sheet**, the layout clients receive: Basic, DA, Sub Total A, Extra 4 hrs, Sub Total B, PF, Medical, Bonus, Leave, National Holiday, Uniform, Training, Sub Total C, Relieving Charges, Sub Total D, Service Charge, Grand Total, then PF, PT, Total Deduction and Net Take Home. Each column is a role on a duty (8 or 12 hours). The older 14-line **wage break-up** is still there as a second format; cards saved earlier keep using it.

**How the lines are worked out** (all rounded to the rupee, as on your sheet):
- Sub Total A = Basic + DA. Extra hours = A x extra hours / 8 (4 for a 12 hour duty). Sub Total B = A + Extra.
- PF 13% and employee PF 12% are on Basic + DA up to the PF ceiling (15,000). Bonus 8.33% and National Holiday 1% are on Basic + DA.
- Leave = A x 21 / (26 x 12). Relieving charges 16.67% are on Sub Total C. Service charge 5% is on Sub Total D.
- ESIC lines appear only when wages are up to 21,000. PT follows the slabs in Settings.
- Net Take Home = Sub Total B minus PF, ESIC and PT.

**Zones.** The 22-05-2026 notification has three zones, not four. Zone 1: areas within the Greater Bengaluru Authority limits. Zone 2: all other municipal corporations and all district headquarters. Zone 3: every other area. A site that was in the old Zone 4 is now in Zone 3, and one in the old Zone 3 (a district headquarters) is now in Zone 2. Confirm each site's zone with your labour consultant.

**Minimum wages.** Compliance, then Minimum wages, holds the Karnataka rates in force: notification KA 411 LWA 2023 dated 22-05-2026 (three zones, four skill categories, D.A. 1,030.80 a month for all). Rate cards and new employees load Basic and D.A. from it by zone and skill category: security guard = Unskilled, supervisor = Semi-skilled, as on the May 2026 cost sheet. The earlier four-zone schedule (valid to 31-03-2026) is kept there for reference only. Edit any amount when a new notification or VDA revision comes (administrators only).

**Employees.** The employee form has a new box: **Use the standard pay structure**. It takes zone, skill category and duty, fills Basic and D.A., adds Extra hours for a 12 hour duty, and sets the monthly gross. Payroll then pays Basic, D.A. and Extra hours, takes PF on Basic + D.A. up to the ceiling, and the payslip shows those lines. Employees already in the system are **not changed**: they stay on their single wage amount until you open them and tick the box. A pay below the minimum wage for the zone and skill is flagged in the form and in Workforce gaps.

**Wage register and invoices.** A cost sheet rate card gives a wage register in the same layout. A guard on a 12 hour duty is billed from the 12 hour column and one on 8 hours from the 8 hour column, matched through the employee's duty. Invoices bill Sub Total D and add the service charge as a separate line.


## Quick quote (phone app)

The **Quick quote** tab turns one figure into the PF and ESIC shares, the guard's pay and the service charge options, with no other settings.

**Billing amount** (the usual case: the client says the most they will pay per guard)
1. Enter the billing amount and choose **GST extra** or **GST included**. The GST % shows beside it (18 to start, you can change it).
2. The table shows, for service charges of 5%, 7%, 9% and 10% (and one of your own), what the **company gets**, the guard's **gross** and the guard's **in-hand**. A higher service charge leaves less for the guard.
3. Tap a row for the full breakdown: employee PF, ESIC and PT, in-hand, employer PF and ESIC, the service charge, billing before GST, GST and the total. It also compares the guard's gross with the minimum wage for an unskilled guard in each zone.

**In-hand salary** (you know what the guard should take home)
1. Enter the in-hand salary. The app finds the lowest gross that gives at least that much.
2. The table shows the service charge options with billing, GST and total.

**Share this quote** sends a short text for the client (WhatsApp or email). It does not say what the company gets.

How it is worked out: employee PF 12% and employer PF 13% on wages up to the PF ceiling (15,000); ESIC (0.75% employee, 3.25% employer) only when gross is within the ESI limit (21,000); bonus 8.33% of the gross (taken as Basic + D.A.), paid by the client and not taken from the guard's pay; professional tax by the Karnataka slab. The service charge is on gross plus employer PF, employer ESIC and bonus. All figures are per guard, per month. Options where the guard's gross falls below the lowest minimum wage (Zone 3) are shown in red. Leave, uniform, training and relieving charges are **not** in a quick quote: use the New card tab for the full cost sheet.


## Paying the government: links in the payroll tool

**Pay cycle, step 7 (Reports)** has a **Pay to government** card for the month. For each of provident fund, ESIC and professional tax it shows the amount, the due date, a **Pay online** button that opens the official portal, and a **paid** tick. The ticks are shared with the Compliance calendar. Below it, **Other payments and filings** covers GST, TDS and the Labour Welfare Fund with their portals.

**Compliance, Filing calendar** has a **Portal** column with an **Open** link on every row that has one.

**Compliance, Pay and file links** lists every portal with what to do there and when. Each address can be changed (administrators only) if a government site moves; clear the box to go back to the standard link.

The standard portals: EPFO https://unifiedportal-emp.epfindia.gov.in/epfo/ | ESIC https://www.esic.gov.in/ | Karnataka professional tax https://pt.kar.nic.in/ | GST https://www.gst.gov.in/ | Income tax (TDS) https://www.incometax.gov.in/ | TRACES https://www.tdscpc.gov.in/ | Karnataka Labour Welfare Board https://klwb.karnataka.gov.in/

The links only open the official sites. Payments are made there with your own login. The app never asks for or stores portal passwords. PF admin and insurance charges are shown as about 1% of the PF wages; the EPFO challan has the exact amount.
