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


## GST for the month (Compliance, GST for the month)

Pick the month. The screen reads the invoices dated in that month (drafts are left out) and sorts them into the GSTR-1 tables:
- **Table 4A:** B2B invoices where you charge GST.
- **Table 4B:** B2B invoices where the client pays the GST (reverse charge).
- **Table 5 and Table 7:** invoices to unregistered clients (Table 5 only for inter-state invoices over Rs 2.5 lakh; otherwise Table 7, by state and rate).
- **Table 8:** invoices to GST-exempt clients.
- **Table 12:** the SAC summary, B2B and B2C.
- **Table 13:** the first and last invoice number and how many were issued.
An invoice with both reverse charge and normal lines is split between 4A and 4B.

**GSTR-3B.** The screen shows the tax on your sales (IGST, CGST, SGST). Enter the input tax credit for the month (from your GST portal purchase statement, plus any balance carried forward) and it shows the credit used, the **cash to pay** and the credit left over. IGST credit pays IGST, then CGST, then SGST. CGST credit pays CGST, then IGST. SGST credit pays SGST, then IGST. The credit you enter is saved for the month.

The two **filed** ticks are shared with the filing calendar. **Download the invoice list (CSV)** gives one row per invoice per table for your CA.

**SAC code.** Settings, Invoice letterhead and bank details, has a SAC code box (998525, guard services, to start). It prints on every invoice and is used in Table 12.

The figures come from your saved invoices. They help you prepare the return; your CA should check them before you file.


## Company profile (brochure)

**Settings, Company profile (brochure)** builds a 5-page PDF: a cover, About us, Our services with Technology and reporting, How we work with your credentials, and a back cover with the contact details. It uses your registrations, address and contacts. The Settings card lets an administrator add things that only you can vouch for. Each prints only if you fill it in:
- the About us paragraph (a standard one is used if you leave it empty)
- the technology and reporting services, one per line as `Title: description` (the standard list is the guard tracking app, attendance tracking, duty roster and relief cover, payroll and compliance, and the monthly billing pack). Change the wording to match exactly what you offer, and add more lines for anything else
- years in business, clients served, staff deployed and sites covered
- your PSARA licence number
- the names of key clients

**Download company profile PDF** builds it from what is in the boxes. Please read every line before you send it to a client, especially the "Why clients choose us" and "Our commitment to compliance" points.

**In the phone app**, the email sheet has **Also send our company profile (PDF)**. The rate card and the profile go in one email as two PDFs. The app remembers your choice. Share offers both files too, and the preview has a **Download the company profile** button.

**The email service must be updated once** for the profile to go by email. Until then the app says so, sends nothing, and still lets you use Share:
- **Cloudflare Worker:** open the Worker in Cloudflare, click Edit code, replace everything with the new `worker/send-ratecard.js`, and click Deploy.
- **Supabase function** (if you use that instead): replace the code of `send-ratecard` with the new `supabase/functions/send-ratecard/index.ts`, and deploy.
The service now accepts up to two extra PDFs per email (6 MB in all) and logs how many were attached.

The brochure shows one contact number, 99860 20293, and names Sathish Reddy as Operations Head. It does not mention the constitution of the business or the proprietor.

**PAN-India services** are mentioned on the cover, in the About us paragraph, in a "PAN-India services" band on the services page, and on the back cover. The minimum wage wording in the brochure refers to "the state of your site" instead of Karnataka.

**Sending only the company profile (phone app).** On the New card tab, the Client box has **Email the company profile only**. It opens the email sheet with the client's email filled in, no wages needed, and a short message that introduces the profile and mentions PAN-India services. Inside the email sheet, the **Rate card / Company profile only** switch changes between the two, and the subject and message follow. Share offers only the profile in this mode. It works with the email service you already have; it does not need the update that sending the profile together with a rate card needs.


## Employee ID cards

**Where.** Employees tab, **ID cards** (top right) for a batch, or the **ID card** button on an employee's row for one person.

**Designs.** Classic (white card, dark header, gold photo frame), Landscape (sideways card with a dark photo panel), Colour-coded (the top band changes by role: gold for guards, blue for supervisors, plum for lady guards, green for housekeeping, red for officers and managers) and Premium dark (dark card with gold edging, for supervisors and officers). All are the standard 54 x 86 mm card size.

**What is on a card.** Front: name, role, ID number, site, the employee's photo (a blank silhouette if there is none), and on the landscape design the phone number and date of joining. Back: a QR code, issue and expiry dates, short terms of use, the authorised signatory (the signature saved in Settings, Payslip signature), and the company address and phone. The QR code holds the employee ID in the form `PFSS:PFSS-0022`, so any phone camera can read it. Issued on starts as today and Valid until as one year less a day; both can be changed.

**Choosing people.** The window lists active employees. Filter by site or role, tick or untick people, or use Select all and Select none. People who have left are not listed.

**Printing.**
- *A4 sheets with cut marks:* 9 portrait cards or 8 landscape cards to a sheet. Print the front page, put the paper back, and print the back page on the other side, flipping on the long edge. The backs are in mirror order so each back lines up with its front.
- *Card printer, one card per page:* every page is exactly card size (54 x 86 mm, or 86 x 54 mm for landscape), front then back, ready for a PVC card printer.

**Photos.** Each photo is cropped to 4:5 from the top, where the face is, and made into a small JPEG. Photos are private, so the app needs the new `pfss-backend.js` to fetch them. If a photo cannot be loaded, that card gets the silhouette and the window says how many.


## Backup (Settings, Backup)

Administrators only. Two buttons:
- **Download data backup** makes `PFSS-backup-<date>.json` with every record in the system: employees, attendance, payroll runs, advances, invoices, clients, contracts, rate cards, licences, filings, settings, the email log and the staff accounts with their roles. The card shows the date of the last backup and how many records it held.
- **Download uploaded files (ZIP)** makes `PFSS-files-<date>.zip` with the photos and documents uploaded in the employee forms. It can take a few minutes if there are many files.

The files hold Aadhaar numbers, bank details and ID copies, so keep them somewhere private (your own computer or a private drive) and never send them on WhatsApp or by email. The dashboard shows a reminder to the administrator when no backup has been made, or when the last one is over 30 days old. A backup that cannot be restored is only half a backup: the JSON file has everything needed, and a restore tool can be added.

This needs the new `pfss-backend.js` (it adds the two read-everything calls, which only an administrator is allowed to use).

## Email an invoice or a payment reminder (Invoicing)

Each invoice row has an **Email** button, and once sent the row shows "Emailed" or "Reminded" with the date. The window offers:
- **Invoice** or **Payment reminder**. An overdue invoice opens as a reminder, with the due date in the message.
- **Invoice only** or **Billing pack** (the invoice, the wage register and the attendance sheet in one PDF). For the pack, pick the site, month and rate card; they are filled in from the contract.
- The sending address (info@, accounts@, hr@), To, CC, subject and message, all editable, and a BCC copy to the sending mailbox.

The client's email comes from the client record. Sending a draft invoice marks it as sent. It uses the same email service as the phone app (`EMAIL_API_URL` in `config.js`) and sends one PDF, so it works with the Worker you already have.

## Guard tracking app wording

The Attendance app checks guards in and out from their phones, records the location and a time-stamped selfie, compares it with the work site's location and radius, flags check-ins away from the site (and can block them), shows who is on duty today, and exports the records. The company profile describes it that way ("Geo-tracking attendance app" and "Attendance you can verify") and does not claim live tracking, because the app records at check-in and check-out. The wording can be changed in Settings, Company profile.


## Signatory on the PDFs: Operations Head

Every PDF that has a signature line (invoices, both rate card layouts and payslips) now reads **name, Operations Head** instead of "Proprietor". It comes from **Settings, Payslip signature**: the **Authorised signatory** box is the name and **Designation** is the title. A designation of "Proprietor" saved earlier is shown as Operations Head, and the box starts as Operations Head. To use another name or title, change those two boxes and, if the person is different, upload their signature image in the same card.

On the invoice, the company block at the top shows the registered name (Satish Kumar K) on its own, with no job title, because it is the name on the GST registration, not a role.


## Pay changes: raising or lowering an employee's wages

**Where.** Employees tab: **Change pay** on an employee's row (or **Change pay...** inside the employee form), and **Change pay for many** at the top for a whole site or role.

**How it works.** Each change has a start date, a reason and a note, and is kept in a history on the employee. Payroll works out each day at the pay in force that day, so a change in the middle of a month is shared out by days. For example, 30,000 rising to 36,000 from 16 September pays 15 days at 1,000 and 15 days at 1,200, so September's gross is 33,000. Leave days, half days, joining and leaving dates are all handled day by day. The payslip notes the change. Employees who have never had a pay change are paid exactly as before.

**Rises.** A rise can start on any date, including a past one. For months whose payroll is already approved, the difference is paid as **arrears** in the month you choose (this month or next), shown as its own line on the payslip. You can choose not to pay arrears.

**Cuts.** A cut can only start in a month whose payroll is not yet approved, needs a reason and the tick that the employee has been told in writing and has agreed, and is refused if it would take pay below the minimum wage (for pay-structure staff, Basic + D.A. for their zone and skill; for others, the state minimum in Settings). The employee's agreement is recorded in the history.

**Other rules.** A new change must start after the latest one. A change cannot start before joining or after leaving. A change dated in the future is stored and takes effect by itself on its date. A change can be cancelled while nothing has been paid with it (not once an approved month used it). Once an employee has pay changes, the pay boxes in the employee form are locked and the pay is changed only through Change pay.

**Pay-structure staff.** The window shows Basic, D.A. and duty hours with the monthly gross worked out as you type, and a button that fills Basic and D.A. from the current minimum wage table (for a minimum wage or VDA revision).

**For many at once.** Choose a site and role, then raise or lower by a percentage or an amount, or set pay-structure staff to the current minimum wages. A list shows each person's present pay, new pay and change, and why anyone is skipped (already at the minimum, not allowed, or a change already exists from that date). Tick the people you want and apply.

**The letter.** Each change in the history has a **Letter** button. It prints the old and new wages, the start date, the reason and any arrears, with a place for the employee to sign, on your letterhead, signed for the company by the signatory in Settings.

**Please check with your CA.** Arrears are treated as wages of the month they are paid in, so PF (on the Basic share, within the ceiling), ESI and professional tax are worked out on them like any other pay in that month. A pay change here changes what the employee is paid; it does not change what a client is billed, which comes from the rate card, so revise the client's rate card separately when a rise has to be passed on.


## Provident fund settings (Settings, Provident fund)

All the PF figures are in one card, with the standard values already filled in.
- **Shares:** employee share (12%), employer share (12%; if you have never set it, it follows the employee share), the part of the employer share that goes to pension, EPS (8.33%), and the pension wage cap (15,000).
- **PF wages:** the wage ceiling (15,000) and the switch to apply it, and a switch to round each amount to the nearest rupee, as the EPFO does. PF wages are Basic + D.A.: for staff on the pay structure that is their Basic + D.A., and for staff paid a single wage it is the "Basic % of gross" in Payroll settings.
- **Charges paid with it:** the admin charge (0.5% of PF wages, with a minimum each month for the whole establishment, 500) and the insurance, EDLI (0.5% of wages up to 15,000).
- **Try it:** type a monthly Basic + D.A. and see the employee deduction, the employer pension and provident fund parts, the insurance and the admin charge before you save. It uses the numbers in the boxes, saved or not.

**PF on the full Basic.** Tick this in an employee's form to contribute on all of the Basic when it is above the ceiling. Pension and insurance stay capped at the pension and EDLI wage caps.

**Pay to government.** The PF amount for the month is now employees + employer + admin charge + insurance, and the card lists the EPFO challan heads: A/c 01 (employee share + employer provident fund part), A/c 10 (pension), A/c 02 (admin) and A/c 21 (insurance). Months approved before this update still total correctly, estimated from their PF.

Please check the figures with your CA before you rely on them for a payment.


## PF and ESI limits in 2026

**PF wage ceiling: Rs 25,000 from 17 September 2026** (it was Rs 15,000 before), under notification S.O. 5109(E). Payroll uses the ceiling in force on each day:
- Months up to August 2026 are worked out on 15,000, exactly as before.
- **September 2026 is a split month**: the ceiling is shared out by days, 16 days on 15,000 and 14 days on 25,000. For a Basic of 30,000 that gives PF wages of 19,667, employee PF 2,360, pension 1,638, provident fund 722 and insurance 98.
- From October 2026 the ceiling is 25,000. A guard with Basic + D.A. of 22,282 now has PF on all of it: 2,674 from the employee and 2,674 from the company (plus the admin and insurance charges), where before it was 1,800.
- Pension (EPS) and insurance (EDLI) are always on wages up to the ceiling, so they follow it too.

In Settings, Provident fund, the ceiling is now a ceiling now, the date it applies from, and the earlier ceiling. A settings record that still says 15,000 moves to the new rule by itself. The "Try it" box has a month field so you can see September 2026 split.

**Staff who now have to be in PF.** Anyone with Basic + D.A. up to 25,000 must be covered. Workforce gaps (Compliance) now lists employees who have PF switched off but fall within the limit. Once enrolled, a member stays a member even if wages later go above the ceiling.

**ESI is not changed.** The ESI wage limit is still Rs 21,000 a month (Rs 25,000 for a person with a disability), with 0.75% from the employee and 3.25% from the employer. A rise to 30,000 has been discussed but not notified.

**Rate cards and quotes.** New rate cards start with the 25,000 ceiling, which raises the PF cost for a 12-hour guard (about 2,897 a month for the company instead of 1,950). Rate cards you saved earlier keep the 15,000 they were made with, so revise them and tell your clients. In the phone app the quick quote now works PF out on Basic + D.A. (taken as the guard minimum wage of 22,282), up to the ceiling.

**September 2026 payment.** The PF for September was due on 15 October. If it was paid on the old ceiling, the difference is still due. Ask your CA about the supplementary payment and any interest.

Please confirm all of this with your CA. The figures come from the published notification and compliance guidance.


## How much of a single wage counts as Basic + D.A. (PF wages)

For staff paid a single wage (not on the pay structure), PF is worked out on the part of the wage that counts as Basic + D.A. By default the tool counts 50% of the wage (Settings, Payroll settings, "Basic % of gross"). That is right only if half of the wage is allowances. **If the whole wage is Basic + D.A., PF would be too low.**

Example: a wage of 16,958.62 that is all Basic + D.A. At 50%, PF wages are 8,479 and PF is 1,017. At 100%, PF wages are 16,959 and PF is 2,035 from the employee and 2,035 from the company.

Two ways to fix it:
- **For one person:** open the employee, and in **Basic + D.A. share of the wage (%)** enter 100 (or the right share). It wins over the company figure. Leave it empty to use the company figure. Someone on the pay structure does not need it, because their PF is always on Basic + D.A.
- **For everyone:** if the whole wage is Basic + D.A. for all your single-wage staff, set the company figure in Settings to 100.

The same share is used for overtime (paid on Basic + D.A.), the "PF not switched on" check in Compliance, and the Basic pay warning in the payroll review. PF is still limited to the ceiling (25,000 from 17 September 2026).


## Who can change pay: the Accounts role

**What each role can do.**
- **Admin:** everything, including Settings, backups and the dated "Change pay" screens.
- **Accounts:** reads and writes all records except Settings, and **can edit an employee's gross wage directly** in the employee form, as often as needed. It is the only role besides admin that can.
- **Manager:** reads and writes all records except Settings, but **cannot change the pay of an existing employee**. In the employee form the pay boxes are greyed out with a note. A manager can still enter a starting pay when adding a new employee.
- **Viewer:** read only.

**How Accounts changes pay.** Open the employee and type the new wage (or Basic and D.A. for someone on the pay structure, or the Basic + D.A. share) and save. There is no start date and no history: the new pay is used for every month whose payroll is not yet approved. Months already approved are not touched. Anyone who had dated pay changes from the earlier Change pay screens is asked once, and those changes are cleared when Accounts saves a new pay. The Change pay and "Change pay for many" buttons are shown only to the admin, and can be ignored.

**Why the database also checks it.** Hiding the boxes stops accidents. The database rule stops everything else: even if someone edits the page, an update that changes pay from a manager or viewer login is refused with "Only Accounts or an administrator can change pay". Saving an employee without touching pay is always fine.

**Set it up (once).**
1. In Supabase, open SQL Editor, paste `supabase/accounts_role.sql` and run it. It is safe to run again. (`schema.sql` has the same rules for a new install.)
2. Create the Accounts person's login: Authentication, Users, Add user.
3. Give them the role: `update public.profiles set role = 'accounts' where email = 'their-email@example.com';`
4. Upload the new `public/index.html` and `public/pfss-backend.js`, then press Ctrl + Shift + R.
5. Sign in as a manager and check that an existing employee's pay boxes are greyed out. Sign in as Accounts and check that they can be edited.

Anyone who is a manager today keeps working as before, apart from pay. Accounts can also be chosen as a payroll approver.


## Entering a wage: Basic + D.A., and what will be deducted

In the employee form, next to the wage there is a box **Basic + D.A. (₹ per month)** (₹ per day for a daily wage). **PF is worked out on this amount.**
- If the whole wage is Basic + D.A., click "The whole wage is Basic + D.A." and the wage is copied into the box.
- If you leave it empty, 50% of the wage is used, and the preview says so.
- Whatever you enter, at least half of the wage counts as Basic + D.A., because the labour codes treat at least 50% of the pay as wages. The preview says when this applies.
- PF is limited to the PF ceiling (25,000 from 17 September 2026). ESI applies when the gross is 21,000 or less. Professional tax follows the gross and the state.
- Staff on the pay structure (Basic and D.A. from the minimum wage table) do not use this box.

**The preview.** Under the wage fields, "What will be deducted, for a full month" updates as you type: gross, what PF is worked out on, PF from the employee and from the company, ESI from both, professional tax, and take-home before advances and absences. It uses the same rules as payroll.

**Attendance is unchanged.** Payroll still takes the wage down day by day for absences and half days, and PF, ESI and professional tax follow the pay actually earned.

**Workforce gaps (Compliance)** now lists anyone with PF whose Basic + D.A. has not been entered ("PF is worked out on 50% of the wage"), so you can find everyone who needs checking. An older percentage set earlier still works, and an amount overrides it.

**Latest rates.** In Settings, Provident fund, the line at the top says whether your PF and ESI settings are the latest 2026 rates. The button **Use the latest 2026 rates** sets them: PF ceiling 25,000 from 17 September 2026 (15,000 before), 12% from the employee and the company, pension 8.33%, admin charge 0.5% with a 500 minimum, insurance 0.5%; ESI limit 21,000 at 0.75% and 3.25%. Your other settings are not touched.

**Accounts and managers.** Basic + D.A. is part of pay: Accounts and the administrator can edit it, and managers see it greyed out on existing employees. Run `supabase/accounts_role.sql` again in the SQL Editor so the database also protects this box. It is safe to run again.


## Why the payroll gross can be higher than the wage amount

The **wage amount** in the employee form is the wage for a full month. The **Gross** in the Payroll table is what the employee earned that month: the wage, reduced for absences and half days, **plus overtime, night shift allowance and arrears**. So they differ whenever any of those apply.

Example: a wage of 25,553 with 62 overtime hours gives a gross of 34,113 (62 hours x 138.07 = 8,560). Overtime is paid at twice the hourly Basic + D.A. (Basic + D.A. / days in the month / 8 hours x 2).

The Payroll table now shows what the gross is made of in small grey text under it, for example "Wage 25,553 + overtime 62 h 8,560", or "Wage for 28 of 31 days 23,078" when there are absences. The column is headed "Gross (with overtime)". Overtime hours and night shifts are entered in the Pay cycle (the overtime and night shifts table). PF, ESI and professional tax follow the rules in Settings: PF and ESI are worked out on the Basic + D.A. part of the wage earned (not on overtime), and professional tax on the gross.

The Advance column is filled from the loans in the Advances tab: for each active loan, the monthly deduction or the balance left, whichever is smaller. A small figure such as 2 usually means a loan with a small balance left, which can be closed in the Advances tab.


## Payroll tab: filter by site and sort

At the top of the Payroll tab, next to Month, there are two boxes:
- **Site:** All sites, or one site (the list comes from the employees of that month, with "No site" for anyone who has none). The choice stays while you change months, as long as that site has employees in the month.
- **Sort by:** **Employee ID** (the default, with numbers in order, so PFSS-0002 comes before PFSS-0010 and anyone without an ID comes last) or **Name**.

**What changes and what does not.** The table and the total net pay show the chosen site only, and a note under the total says, for example, "Showing 2 of 5 employees, at Avio SEZ. All sites together: ₹…". The payroll that is calculated, approved and saved is always for **everyone**: the filter and the sort change only what you see, never what is saved. Payslips and downloads for the month are not affected by the filter either.


## Additional pay: bonus, incentive, adjustment and other lines

In the **Pay cycle**, step **Attendance and shifts**, the table has an **Additional pay** column. The button in it shows "Add", or the total and the number of lines such as "3,500 (2)". It opens a small window for that employee and month, where you add as many lines as you need:
- **For:** Bonus, Incentive, Adjustment, Allowance, Reimbursement or Other.
- **Amount** and an optional **note** (for example "Diwali bonus"). The amount must be above zero. To take money off, use "Other deduction". There can be up to 10 lines for one employee in a month.
- **Count for ESI and professional tax:** a tick box. It starts unticked for a Bonus and a Reimbursement and ticked for the others, and you can change it for each line.

**How the lines are treated.** They are added to that month's gross pay. PF is never worked out on them (PF is on Basic + D.A.). ESI and professional tax are worked out on the wage plus overtime, night shifts, arrears and only the additional pay lines that are ticked. Whether ESI applies at all still depends on the wage, not on these lines. Absences reduce the wage as before, and the lines are added on top.

**Where it shows.** On the payslip each line is its own line under Earnings (for example "Bonus - Diwali bonus"). In the Payroll table the note under the gross reads, for example, "Wage 25,553 + bonus 2,000 + incentive 1,500". The review table has the column "OT, shifts and additions", and employees with additional pay appear in the review step. After adding or removing lines, recalculate the payroll.

**Who can add them.** Only Accounts and the administrator. A manager can see the lines but not change them, and can still enter overtime and nights without touching them. A closed month is read-only for everyone. The database enforces this too: run `supabase/accounts_role.sql` again in the SQL Editor (safe to run again).

Please confirm with your CA how a bonus or reimbursement should be treated for ESI and professional tax in your case, and change the tick for that line if needed.


## Who can send email, and giving Accounts full admin access

**Sending email** (invoices, payment reminders, rate cards and the company profile) is allowed for **admin, Accounts and manager**. Viewers cannot. The email service checks the person's role every time. After this change, update the service once:
- **Cloudflare Worker:** open the Worker, Edit code, replace everything with the new `worker/send-ratecard.js`, and Deploy.
- **Supabase function** (if you use that instead): replace the code of `send-ratecard` with the new `supabase/functions/send-ratecard/index.ts` and deploy it.

Before this update, only admin and manager were accepted, so an Accounts login saw the email window and then got "Only administrators and managers can send email".

**Admin or Accounts?** Both can edit employees and pay, add additional pay, run payroll, make invoices and send email. Only **admin** can also:
- open **Settings** (PF and ESI rates, invoice letterhead, signature, approvers, rate card defaults)
- make **backups** (the data backup holds Aadhaar numbers and bank details of everyone)
- use the dated **Change pay** screens
- change who has which role

To give the Accounts login full admin access, run in the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'accounts@publicforcesecurity.com';
```

To put it back to the Accounts role:

```sql
update public.profiles set role = 'accounts' where email = 'accounts@publicforcesecurity.com';
```

Keep at least one other admin (for example info@), and give admin only to people you trust: an admin can read and export all personal data, change the PF and ESI rates, and change roles. The person signs out and in again for the change to show.


## Payroll groups: run payroll separately for each client or site, and role

Use this when different clients, sites or roles are paid on different days, or need their own approval. Open the **Pay cycle** and click **Payroll groups** (next to the pay month), or use "Set up payroll groups" on the overview.

**Making a group.** Give it a name (for example "Paragon Tapes guards"), choose a **client or site**, a **role**, or both, the **month it starts from**, and optionally a **pay day** (the day of the next month by which that group's salary should be paid) and a note. Only Accounts and the administrator can make or change groups. Managers can see them.

**Who is in which group.** Each employee is in exactly one group: the most specific group that matches their site and role (site and role together beat a site alone, and a site alone beats a role alone). If two match equally, the older group wins. Everyone who matches no group stays in **Everyone else**, which is the normal payroll as before. A group applies only from its first month, so earlier months are not changed.

**Running a group.** Pick the group in the **Payroll group** box at the top of the Pay cycle (or in the Payroll tab). Every step then works on that group's employees only: attendance and shifts, review, calculation, validation, approval, payslips and closing the month. Each group is approved and closed on its own, so one client can be paid on the 5th and another on the 10th. The overview shows a table of all the groups for the month with their status, net pay and pay day, and warns when a group is due soon or overdue.

**Government payments stay together.** PF, ESI and professional tax are paid for the whole month. The Reports step adds up the groups whose payroll is **approved** and lists any group still to be approved, so the EPFO challan covers everyone who has been approved.

**Safety rules.**
- A group cannot start in a month where payroll is already calculated for employees who would move into it. Choose a later month.
- The site, role and first month of a group cannot be changed. To change them, end the group (set its last month, which cannot be before its last payroll) and make a new one.
- A group can be deleted only while it has no payroll.
- A change to an employee, their attendance, overtime or additional pay sends only that employee's group back to draft, not the other groups.
- Pay-change locks (for example, a pay cut cannot start in an approved month) look at the employee's own group.

**Pay rates** stay on each employee. A group controls how and when payroll is processed, not the wage. Run `supabase/accounts_role.sql` again in the SQL Editor so the database also refuses changes to groups from anyone but Accounts and the administrator (safe to run again).


## PF and ESIC upload files

In the **Pay cycle**, step **Reports**, the card **Files for the PF and ESIC portals** makes the monthly files from the **approved** payroll. When payroll runs in groups, each file covers every group that is approved, so download after the last group is approved.

**PF return file (ECR).** A text file, `PFSS-ECR-<month>.txt`, with one line per member and these fields joined by `#~#`: UAN, member name (capitals), gross wages, EPF wages, EPS wages, EDLI wages, EPF contribution (the employee's 12%), EPS contribution (8.33%), the difference to the employer's EPF (3.67%), days of non-contributory service (days not paid), and refund of advances (0). The EPF wages are the Basic + D.A. up to the PF ceiling, with September 2026 split by days at the 17 September change. The totals match the EPFO challan heads shown in "Pay to government".

**ESIC monthly contribution file.** An Excel file, `PFSS-ESIC-<month>.xlsx`, with the six columns of the ESIC template: IP number, name, days paid, total monthly wages, reason code for zero days, last working day. The wages are the wages that count for ESI (additional pay lines you did not tick are left out). An employee with no days worked gets reason code 1 (on leave), or 2 (left service) with the last working day when they have left. The portal works out the contributions itself. If the portal asks for the older .xls type, open the file in Excel and use Save As, Excel 97-2003 Workbook.

**Please check before you submit.** The card lists anyone left out because the UAN is missing or is not 12 digits, or the ESIC number is missing, and warns about an ESIC number that is not 10 digits. Employees left out are not in the file even though their PF is in the amount to pay, so fix their numbers first. Upload the PF file to the EPFO portal and use its Validate step, and look at the ESIC sheet once before uploading. The portals can change their formats, so if one rejects a file, send me the message.

## Restore from a backup

In **Settings**, **Backup**, the part **Restore from a backup file** brings records back from a data backup (.json). Only an administrator can use it. Steps: choose the file, click **Check the file** (it shows, for each kind of record, how many are the same as now, how many differ and how many are missing), tick what to bring back, type `RESTORE`, and click **Restore**.

- **Nothing is deleted.** A record in the file replaces the same record in the system, and records that are only in the system stay as they are.
- **A safety copy is downloaded first**, named `PFSS-before-restore-<date>.json`. It is a normal backup file, so you can restore it later to undo the restore. If it cannot be saved, nothing is restored.
- Only records that differ or are missing are written, in batches. If it stops part-way it says after how many records, and you can run it again.
- It restores **data**. Staff logins stay in Supabase, and uploaded photos and documents stay in storage (the ZIP is for your own safekeeping).
- **Upload the new `pfss-backend.js`** with the new `index.html`, or the screen will say the restore needs the updated file.

## Profit per client

In the **Invoicing** tab, the card **Profit per client** (Accounts and administrator only) sets, for a service month, what each client was **invoiced before GST** against what their staff **cost the company**, plus **other costs** you type in for that client and month (uniforms, transport, supervision).

- **Staff cost** is the pay plus the employer share of PF and ESI, the insurance (EDLI) and the PF admin charge, from the latest payroll of that month (all payroll groups). The note says which groups are not approved yet.
- **Which client** an employee belongs to comes from the **contracts**: the contract for the employee's site that is in force that month. Staff at a site with no contract appear on their own line, "Staff not linked to a client", and still count in the total. Add a contract for that site to link them.
- Draft invoices are not counted. Loss-making clients show in red, with the margin. **Download as CSV** saves the table.
- The database also refuses changes to the entered costs from anyone but Accounts and the administrator: run `supabase/accounts_role.sql` again (safe to run again).


## The look of the tool

The tool has four looks, chosen with the **Look** box at the top right of every page. The choice is remembered on that device. It opens in **Aurora** the first time. Changing the look changes only colours, type and shapes. Every word on the screen, every calculation and every file made by the tool is the same in all four.

- **Aurora.** Soft violet gradient sidebar with icons and a white pill on the active item, frosted sheets with large soft corners, gradient buttons and coloured icon chips on the figures. Light colours at all times.
- **Horizon.** A sunrise band (violet, raspberry, orange) behind each page title with the white sheets overlapping it, a white sidebar with a differently coloured icon for each menu item, raspberry buttons and IDs. Light colours at all times.
- **Executive.** The dark look: near-black blue, champagne-gold buttons and active item, serif titles, thin gold rules under table headings. Dark at all times.
- **Register.** The look from the previous round: ledger-paper background, ruled sheets, signage blue, a yellow active item, stamp-style status tags. It follows the device's light or dark setting.

Fonts load from Google Fonts (Bricolage Grotesque, Fraunces, IBM Plex Sans, Plus Jakarta Sans, Sora), and only the ones the chosen look uses are downloaded. Offline, a device falls back to its own fonts and the layout still works.

**Fixing one look for everyone.** Once you have chosen, ask for the other three to be removed. The Look box then goes away and the chosen look is the only one, so nobody can change it by accident.

**Going back to the very first look.** `previous-look/index.html` is the same tool, with every current feature, in the original teal-and-dark-sidebar look and without the Look box. It is ready to upload to the `public` folder in place of `index.html`, next to the same `config.js` and `pfss-backend.js`.

The phone rate card app (`public/ratecard/index.html`) has its own stylesheet and keeps its current look. The PDFs (payslips, invoices, the company profile and ID cards) are also unchanged.


## Payslips on WhatsApp

In the **Pay cycle**, step **Payslips and bank file**, the card **Send payslips on WhatsApp** appears once the payroll is approved. It covers the payroll group you have chosen. It works in two ways. **The first needs no set-up and no business account, and it works now.**

### Without a business account (works now)
You send from your own WhatsApp (the ordinary app, the free WhatsApp Business app on a phone, or WhatsApp Web), one employee at a time:
1. Click **Open chat**. WhatsApp opens with the employee's number and the message already written, and the employee's own payslip PDF is downloaded.
2. Attach the PDF and press send.
3. Click **Mark sent**, so you can see who is done.

What else the card gives you:
- **Status for each employee:** Not sent, Chat opened, or Sent (by hand). The marks are saved, so Accounts and managers all see the same list, and a count at the top shows how many are done. **Undo** takes a mark off if you clicked by mistake.
- **Download each payslip as its own PDF (ZIP).** One ZIP with a separate PDF for every employee, named by ID and name, so you can attach from a folder instead of downloading one at a time.
- **Share PDF (phones).** On a phone it hands the PDF and message to the share sheet: choose WhatsApp, then the employee.
- **Numbers are cleaned automatically** (spaces, dashes, +91, 91, a leading 0, two numbers in one field), and anyone with an unusable number is flagged so you can fix the phone number on the Employees tab.

WhatsApp does not offer an official way for an ordinary number to send messages automatically. Tools that pretend to be WhatsApp Web can get the number blocked, so this tool does not use them.

### With a business account (optional, later)
If you ever want one click to send to everyone, you can add the WhatsApp Business Platform. Nothing changes until you do. The card then shows a green "ready" line and the buttons **Send to all not yet sent**, **Send to ticked**, **Send** for one person and **Send a sample**, in addition to Open chat.

### How the automatic sending works
The app builds the payslip PDF in the browser and sends it to a small service you run on Cloudflare (`worker/send-whatsapp.js`). The service holds the WhatsApp key, uploads the PDF to WhatsApp, and sends an approved message template with the PDF attached as its header. The employee sees a normal WhatsApp message from your business number with the PDF in it. WhatsApp only allows a business to start a conversation with a message template that Meta has approved, which is why a template is needed.

### Set-up, once
1. **Meta Business account.** At business.facebook.com, make or open your company's business account, and add the WhatsApp product in a Meta developer app (type Business). Business verification is not needed to start.
2. **A number for the business.** Add a phone number to the WhatsApp Business Platform and verify it with the code WhatsApp sends. Use a new SIM or a number you do not chat on. A number used on the Business Platform generally cannot also be used in the ordinary WhatsApp apps at the same time, so check Meta's current rules before you move 99860 20293.
3. **Two values.** In the WhatsApp section of the developer app, "API setup" shows the **Phone number ID** (a long number, not the phone number itself). Copy it.
4. **A permanent token.** In Meta Business settings, Users, System users, add a system user, give it your app and WhatsApp account, and generate a token with the permissions `whatsapp_business_messaging` and `whatsapp_business_management`, set to never expire. Copy it and keep it secret.
5. **The message template.** In WhatsApp Manager, Message templates, create one with:
   - Name: `payslip`. Category: **Utility**. Language: English.
   - Header: **Document** (upload any sample PDF when asked).
   - Body, exactly: `Hello {{1}}, your payslip for {{2}} from Public Force Security Services is attached. This is a private document meant only for you. For any query, call 99860 20293.`
   - Sample values when asked: {{1}} = Krishnappa M, {{2}} = October 2026. No footer and no buttons.
   Submit it. Approval usually takes under a day. The tool needs the template to be **Approved**.
6. **The Worker.** In Cloudflare, make a Worker called `pfss-whatsapp`, paste in `worker/send-whatsapp.js`, deploy it, and in its Settings, Variables and Secrets add:
   - `WA_TOKEN` (secret): the permanent token.
   - `WA_PHONE_ID`: the Phone number ID.
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY`: the same as in `config.js`.
   - Optional: `WA_TEMPLATE` (default `payslip`), `WA_LANG` (default `en`), `WA_VERSION` (default `v23.0`; change it if Meta retires that version), `ALLOWED_ORIGIN`, `DAILY_LIMIT` (default 400).
7. **config.js.** Add one line to your own `config.js`: `WHATSAPP_API_URL: "https://pfss-whatsapp.YOUR-ACCOUNT.workers.dev",` and upload it with the new `index.html`.
8. **Try it.** In the card, type your own number in "send a sample payslip" and click **Send a sample**. It sends a payslip with every amount at zero. If it arrives, everything is working. If not, the message on the card says what to fix.

### Costs and limits
- Meta bills per delivered template message. In India a utility message such as a payslip costs roughly 11 to 16 paise, so 100 payslips a month is about 12 to 16 rupees, plus GST. Check Meta's current rate card, because prices change on the first day of a quarter.
- A new account can message up to 250 different people in 24 hours. That is enough for a team of up to 250, and it grows when you verify the business. For more than 250 employees, send in two days or verify the business.
- The Worker allows 400 payslips per person per day (change `DAILY_LIMIT`).

### What the card shows
- **Sent** means WhatsApp accepted the message. It does not show that the employee has read it. A message to a number that is not on WhatsApp shows as **Failed** with the reason. Anyone you marked by hand shows as **Sent (by hand)**, and an opened chat shows as **Chat opened**.
- Every attempt is saved against the employee and month (who sent it, when, the last 4 digits of the number, and the message id), so you can see who has had theirs. The Worker keeps its own log with the last 4 digits only. Neither keeps the whole number, the PDF or the key.
- **Send again** asks first, so nobody gets two by accident. **Stop** ends a batch after the one being sent. A problem that would fail every message (an expired token, a missing template, a payment problem on the Meta account) stops the batch at once, and the message says what to fix.

### Phone numbers
The number comes from the employee's phone field and is cleaned automatically: spaces, dashes, brackets, +91, 91 and a leading 0 are all accepted. If two numbers are saved, the first usable one is used. An Indian mobile must have 10 digits starting with 6, 7, 8 or 9. Anyone whose number cannot be used is marked "No valid number", and the card says how many. Fix the phone number on the Employees tab.

### Privacy
A payslip shows pay and deductions, and the bank details of the employee. Send it only to the employee's own number: check the numbers first, tell your staff that payslips will come on WhatsApp, and keep their agreement on record. Keep the WhatsApp token secret. If it is ever lost, remove the system user's token in Meta Business settings and make a new one. The payslip PDF is not password-protected.

### If something goes wrong
- **"Not set up yet" or "works on your own site".** The line in `config.js` is missing, or you are in the Claude preview. Open chat still works.
- **Template not found or not approved.** Check the template name and language in the Worker settings, and that it shows Approved in WhatsApp Manager.
- **Access expired.** Make a new token and replace `WA_TOKEN`.
- **Only numbers on the allowed list.** The number is still in test mode in the Meta app. Finish adding your own number.
- **Payment problem.** Add a payment method to the WhatsApp Business account in Meta Business settings.
- **Could not deliver.** That number is probably not on WhatsApp. Use Open chat, or email the payslip.
