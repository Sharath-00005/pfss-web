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


## Authorised signatory, and authenticated invoices

### Who signs: Sharath R, Accounts Head
Every invoice, payslip, payroll register and letter now names **Sharath R, Accounts Head** as the authorised signatory. Anything saved earlier with the old default (the registered name, "Satish Kumar K", with "Operations Head" or "Proprietor") is replaced automatically, so nothing needs saving for the new name to appear. To change it later, go to **Settings, Authorised signatory, signature and stamps**, type a name and designation, and click Save. A name saved there is kept as typed.

The registered (legal) name **Satish Kumar K** is still shown in the supplier block of the invoice, because that is the name on the GST registration (GSTIN 29AQEPK6324M1ZG). The invoice must show the supplier as registered, so change that only if the registration itself changes.

### The authentication stamp on an invoice
Every issued invoice PDF carries, above the signature:
- **"Electronically issued and authenticated"**, the billing system, the person who generated it (for example Sharath R (Accounts)) and the date and time in IST.
- A **Document ID** such as `INV-101-7K3D9Q2M4X1B`, which is a fingerprint of the invoice: number, dates, client and its GSTIN, every line, the rates, GST and the notes. If any of those change, the ID changes.
- A **QR code** holding the invoice number, date, total, the company GSTIN and the code.
- The Document ID again in the footer of every page, and in the PDF's own properties (File, Properties in a PDF reader), where the creator is shown as the Public Force billing system.

A **draft** invoice, or a copy made from the editing window with changes that are not saved yet, says "Draft, not yet issued" or "Preview, not saved" and carries no Document ID. Sending an invoice by email makes a draft final. The sample letterhead says it is a sample. A downloaded invoice is now named `Invoice-101.pdf`.

If a **signature image** is saved in Settings, it is printed above the signatory's name on invoices and payslips.

### Verify an invoice
In **Invoicing**, the card **Verify an invoice** takes a Document ID, or the text a QR scanner reads from the code, and checks it against the invoices saved in the system:
- **Genuine:** it matches the invoice as saved now, and nothing has changed since it was issued.
- **Issued, but changed since:** the ID belongs to an earlier version. Saving an invoice keeps a short history of its Document IDs, with who saved it and when.
- **Does not match** or **no invoice with that number:** the document was not produced by this system, or has been altered, or the ID was copied wrongly.
Clients cannot check by themselves, because the tool needs a sign-in. A client can phone the office with the ID.

### The GST signature rule (please ask your CA)
Rule 46 of the CGST Rules asks for the **signature or digital signature** of the supplier or an authorised representative on a tax invoice. It does not ask for it on an official **e-invoice** (with an IRN from the government portal), which is compulsory above Rs 5 crore turnover. The authentication here proves the invoice came from your system and has not been changed. It is **not** a government e-invoice and **not** a digital signature, so the invoice still shows the authorised signatory's name, and the safest course is to sign it: on paper, or with a Digital Signature Certificate. Some commentary says that a remark such as "computer generated, no signature required" does not make an invoice valid for the buyer's input tax credit, and that a scanned signature is not a digital signature. For that reason the invoice does not say "no signature required". Ask your CA whether a signature image is enough for your clients, or whether to get a Digital Signature Certificate.


## Extra duty: 1.5 or 2 duties on the same day

### Marking it
On the **Attendance** screen, click a day cell to cycle through: Present, Absent (unpaid), Half-day, Paid Leave, **1.5 duties**, **2 duties**, and back to Present. A day with an extra duty shows as a violet cell with a small "x2" or "x1.5" in the corner, and the hover text says "Double duty (2 duties)" or "1.5 duties". An extra duty can only be on a day that was worked: changing the day to Absent, Half-day or Leave clears it, and a duty marked before the person joined or after they left is ignored. A closed month cannot be changed. Importing attendance from the Attendance app keeps the duties already marked.

### How it is paid
Each extra duty is paid as **one extra day at the normal daily rate**: 2 duties on a day is one extra day, 1.5 duties is half an extra day. The daily rate is the monthly wage divided by the days in the month (for a daily wage, the wage for one day; for the 12-hour pay structure, the whole monthly pay divided by the days). If the wage rose in the month, each extra duty is paid at the rate of its own day.
- **Payslip:** a separate line, such as "Extra duty (1.5 duties)", under "Pay for days worked" (or after Basic, D.A. and the extra hours on the pay structure).
- **Payroll table:** the note under the gross reads, for example, "Wage for 28.5 of 30 days 16,111 + extra duty 1.5 848". Days present stays as before (the regular days). The Payroll table now refreshes whenever you open the tab.
- **PF:** the Basic and D.A. part of the extra duty pay counts for PF, up to the PF ceiling.
- **ESI:** who is covered still depends on the wage (a wage of 20,500 stays covered even when extra duties take the month over 21,000), and the ESI is worked out on everything paid.
- **Professional tax:** follows the total paid.
- **Pay cycle:** the review step has an **Extra duty** column, and an employee whose only exception is an extra duty is listed there. The checks warn when someone has more than 10 extra duties in a month.

Extra duty is paid at the normal day rate, as asked. Overtime by the hour (paid at 2 times the hourly rate) is still entered as OT hours in the pay cycle. Work beyond normal hours can count as overtime under labour rules, so please ask your CA or labour consultant whether a double duty should be paid as overtime instead of a normal extra day.

### Client billing
Extra duties count as **days worked** in what you bill the client: the wage register, the totals on the attendance sheet, and the man-days on invoices made from a contract. The attendance sheet for the client shows the "2" or "1.5" on those days and explains it in the key. This is on by default. If you do not bill clients for extra duties, switch it off in **Settings, Overtime, night shifts and employer ESIC** (the box "Count extra duties ... in client billing") and save.


## Sundays and holidays: paid day off, and holiday work

### Setting it up
- **For each person:** open the employee record and choose the **Weekly off day** (None, or Sunday to Saturday), and tick **Company holidays are paid days off for this person** if that applies. People who work every day, such as guards, are left on "None", and nothing changes for them. Only Accounts and the administrator can change these two fields on an existing employee, because they decide how work on those days is paid.
- **Company holidays:** on the **Attendance** screen, in the box above the grid, pick the date, type the name (for example Deepavali) and press **Add holiday**. Each month has its own list. A closed month cannot be changed. A holiday is a day off only for the people who have the company holidays tick.

### In the register
A day that is a person's weekly off, or a company holiday for them, shows with **stripes**. It is paid as part of the wage, as before: you do nothing if they did not work. If they worked, click the day:
1. first click, **worked**: the holiday stays paid and **one extra duty** is added (violet cell, "x2");
2. second click, **half a day worked**: holiday pay and half an extra duty ("x1.5");
3. third click, **absent**: the holiday is not paid;
4. fourth click, back to a **paid day off**.

The hover text on each day says what it means, for example "Sunday (weekly off), worked. Holiday pay and 1 extra duty". Ordinary days keep the cycle described in the extra duty section above.

### How it is paid
The holiday itself is already in the monthly wage (or in the daily wage count, as unmarked days are paid), so holiday pay plus an extra day makes **two days' pay for that day**. The payslip shows the extra day on its own line, such as "Holiday work (1 day)", apart from "Extra duty" on ordinary days. In **Settings, Overtime, night shifts and employer ESIC**, the box **A duty worked on a weekly off or holiday is paid at (times the daily rate)** is 1 by default (a normal day). Put 2 if holiday work is to be paid at double: the payslip then reads "Holiday work (1 day at 2 times)". The rate applies only to holiday work. PF, ESI eligibility, professional tax and the day-by-day rule when the wage rises in a month work exactly as for extra duty. The pay cycle review has a **Holiday work** column next to **Extra duty**, and the Payroll table note reads, for example, "Wage 15,500 + extra duty 1 500 + holiday work 1 500". In client billing, holiday work counts as days worked with extra duties, under the same Settings box.

Whether holiday work must be paid at a higher rate depends on the law that applies to the establishment and on the contract, so please confirm the rate with your CA or labour consultant and set it in Settings.

### After you change a holiday
Adding or removing a holiday, or changing someone's weekly off, can change the pay of anyone who worked on that day. Recalculate payroll for the month afterwards. Adding or removing a company holiday sends that month's payroll back to draft, so it needs approval again.

### Database
Run `supabase/accounts_role.sql` again once (it is safe to run more than once). It now also stops anyone other than Accounts and the administrator from changing the weekly off day or company holidays on an existing employee. Holidays are saved in their own collection, which needs no new table.


## The attendance sheet PDF, in the format of your paper register

The attendance sheet for a client (from the Billing pack) now follows the paper register:
- **P** is one duty on an ordinary day. **Two P's stacked** (one over the other) are two duties. A **4 over a P** is one and a half duties: the 4 is the extra half day.
- **Red days** are weekly offs and holidays (the day number is red, and the day is shaded for the people it is a day off for). It is **blank** if the person did not work (the day is paid), **P** if they worked (an extra duty), and **4** if they worked half a day.
- Columns on the right: **Present** (days paid that are not weekly offs or holidays), **W/O** (paid weekly offs and holidays), **O/T** (extra duties, including work on a day off) and **Total**, which is Present + W/O + O/T. The last row adds up each column. Halves are written as 10.5 (the PDF font has no half sign).
- A key under the table explains the marks, and lists the company holidays of the month.
- Someone who joined in the month has "-" before joining and only the days off after joining count in W/O. **A = absent** is unpaid. The red "L" on a paper sheet that is not counted in the total should be marked **Absent** in the register. In this system **L = paid leave**, which is paid, and is counted in Present.
- If **Count extra duties ... in client billing** is switched off in Settings, the sheet shows ordinary days only, O/T shows "-", and the key says extra duties are not shown.

For October 2026, the rows of the sample (examples folder) come to the same Present, W/O, O/T and Total as the paper register: 25, 6, 12, 43 for a person with 12 extra duties, 25, 6, 10.5, 41.5 with a half day, 23, 6, -, 29 with two absent days, and 16, 4, -, 20 for someone who joined on the 9th.


## Holidays are visible for everyone, and one click sets weekly offs

### On the Attendance screen
- A **company holiday** is marked on its day for **everyone** in the grid: a gray cell with a red mark along the bottom, and the hover text "company holiday: Gandhi Jayanthi, not a paid day off for this person". This shows even when nobody's record has been set up.
- For the people to whom it is a **paid day off** (their weekly off day, or a company holiday when their record has the holidays tick), the cell is **gray with stripes**. Clicking it works as described in the section on holidays above.
- A small key above the holiday box shows what each kind of cell means.

### One click for everyone shown
For Accounts and the administrator, the box **Weekly off and company holidays for the people shown** sits under the holiday box. Choose the weekly off day, tick or untick **Company holidays are paid days off**, and press **Apply to the N people shown**. It sets it on everyone currently listed, so choose a site in the Site filter first to set one site only. The line above the button shows how things are now ("11 with no weekly off; 0 get company holidays as paid days off"). People whose record already has the same setting are not touched. You can still change one person in their employee record. If the month is already calculated, recalculate it afterwards.

### On the attendance sheet PDF
A company holiday has a **red heading that reads HOL** above the day number, and the whole column is shaded for every person. A weekly off has a red heading with the weekday, such as **SUN**. The holiday names are listed in red under the table, with a short key.


## Version line in the menu
Under the name at the top of the left menu a small line reads, for example, "Version: 10 Nov 2026, build 28". After you upload a new `index.html`, press Ctrl + Shift + R and check this line, so you know the new file is the one being shown. If it still shows an older build, the new file has not been deployed yet (check the Deployments tab of the Cloudflare project) or the browser is showing a saved copy.


## Pushing a payroll through when there are errors

On the **Validate PF, ESI and deductions** step, errors (a missing UAN, ESIC number or bank detail, a negative net pay) normally stop the payroll from going for approval. If you must carry on now, **Accounts or an administrator** can use the card **Push through with the errors**:
1. Write the reason (at least 8 characters), for example "UAN of the new joiners will be added before the PF return".
2. Tick the box that says you know the errors are not fixed.
3. Press **Push through with N errors**.

The errors stay on record and are shown in amber as **Pushed through**. The payroll can then be submitted, and the **approver sees a banner** on the approval step with the number of errors, who pushed them through, when, the reason, and the list of people and problems. The step is also written in the activity log. **Withdraw the push-through** puts things back (until the payroll is submitted). A push-through belongs to one calculation only: running the checks again, recalculating, or changing attendance or an employee's record withdraws it, and the checks must be passed or pushed through again. Other roles cannot push through.

### What happens to the people with the errors
- **Bank transfer file:** a bank rejects a whole upload for one bad line, so the file now leaves out anyone whose bank account number or IFSC is missing or invalid, or whose net pay is zero or less. After the download a message says who was left out, and the **Payslips and bank file** step keeps a yellow list with the reason and the net pay, so you can pay them another way.
- **PF return file (ECR):** people without a 12-digit UAN were already left out and listed. **ESIC sheet:** people without an ESIC number too.
- Payslips are made for everyone as usual.

## Additional documents on invoice and billing pack emails

In **Invoicing, Email**, under what to attach, **Additional documents (optional)** lets you add up to **10 files**, about **10 MB each and 15 MB in all**, to the invoice or the billing pack (for example the PF and ESIC challans, a work order, a signed attendance sheet). Allowed: **PDF, JPG, PNG, Word (.doc, .docx), Excel (.xls, .xlsx), CSV and text**. Programs, web pages, zip files and Word or Excel files with macros are refused.
- A **photo** over about 0.6 MB is made smaller automatically (longest side 1800 pixels, saved as JPEG), so an 11 MB phone photo goes as under 1 MB.
- When you add a file, its **content is checked against its name** (a PDF renamed .png, or a program renamed .txt, is refused at once). The email service checks it again.
- Each file has a **Remove** button, the list shows the total, and the window starts empty each time. If sending fails, the files stay on the list.
- The email log keeps the number of files and their names, and the invoice records the names under "emailed files".
- Keep the whole email under about 15 MB: the client's own mail server may refuse a bigger one, even though the email service allows more (Resend accepts up to 40 MB, counted after encoding).

### How the files travel, and the one-time setup
The files used to go inside the request to the email service (the Cloudflare Worker), which has to hold them in memory and pass them on. On Cloudflare's **free plan a Worker gets only 10 ms of processing time and 128 MB of memory per request**, so even a few MB can fail with "Worker exceeded resource limits", and that is why only some files went through. Now the page puts each file in **private storage** (a bucket called email-attachments) just before sending, and the email service receives only a **short-lived link** (valid for 2 hours) which the mail provider uses to fetch the file. Big files never pass through the Worker.
1. **Run `supabase/email_attachments.sql` once** in Supabase (SQL Editor, paste, Run). It makes the private bucket and lets administrators, managers and Accounts use it. It is safe to run again, and it is also part of `schema.sql` for a new setup.
2. **Replace the code of the email Worker** with the new `worker/send-ratecard.js` and press Deploy (or `supabase/functions/send-ratecard/index.ts` if you use the Supabase Edge function). Nothing else changes; no new secret is needed.
3. Upload the new `index.html`.

- **Privacy:** the bucket is private. A file is reachable only through the link made for that email, which stops working after 2 hours, and the page deletes any file in the bucket that is more than 3 days old (each time the page is opened and someone opens the email window). To empty it sooner, open Storage, email-attachments in Supabase and delete the files.
- **The service checks the link:** it accepts only links into this bucket (not another bucket, another site, or a folder), looks at the first bytes of each file to check its type and size, and refuses a file that is over 10 MB, or files over 15 MB in all.
- **Until step 1 is done:** the page still sends up to **4 small files (3 MB each, 7 MB in all)** the older way, inside the request. A bigger lot stops with a message that says to run email_attachments.sql.
- If a Worker still reports running out of time on a plain email with no extra files, the Worker is being asked to do too much for the free plan, and Cloudflare's paid Workers plan (a few dollars a month) removes the limit.

## Invoice numbers: PFSS/26-27/0001

### The format
Every new invoice is numbered like **PFSS/26-27/0001, 0002, 0003**: the prefix, the **financial year** (April to March, worked out from the **invoice date**, so an invoice dated 2 April 2027 is PFSS/27-28/0001) and a running number that **starts again at 0001 every financial year**. The number is filled in for you and can be changed in the **Invoice #** box.

GST (CGST Rule 46(b)) says a tax invoice number must be consecutive, **at most 16 characters**, use only **letters, numbers, - and /**, and be **unique for the financial year**. PFSS/26-27/0001 is 15 characters. The box stops at 16 characters and checks what you type as you type: a character that is not allowed, a number starting with / or - (the e-invoice portal does not accept that), and a number already used by another invoice (it names that invoice) are all refused, also when you press Save. Please confirm with your CA if you use more than one series.

### Changing the number of an invoice
- **New invoice:** type another number in the box, or press **Use the next number**. If you change the invoice date to another financial year, the suggestion follows it, unless you have typed a number yourself.
- **Saved invoice:** Accounts and the administrator can change the number in the same box (for a manager the box is locked). A **draft** changes at once. An invoice that was **already issued** (sent, paid, or emailed) first shows a warning: the client still has the old number, the Document ID on that copy no longer matches, and an invoice already in a GST return has to be corrected in the return.
- **History:** each invoice keeps its earlier numbers (shown under the box as "Earlier numbers of this invoice"), and the **Verify an invoice** check still recognises a Document ID printed under an earlier number and tells you the invoice was renumbered, and from what to what.
- Document IDs now read like INV-PFSS-26-27-0001-7K3D9Q2M4X1B (the slashes become dashes), and downloaded invoices are named Invoice-PFSS_26-27_0001.pdf.

### The "Invoice numbers" window (Invoicing page, Accounts and administrator)
- **Prefix and digits:** the prefix (1 to 6 letters or numbers, PFSS to begin with) and 3, 4 or 5 digits. It checks that the whole number stays within 16 characters. A new prefix starts a new series.
- **Next number:** choose the financial year and set the number the next invoice gets, for example 11 if invoices 1 to 10 were made outside the system. It cannot be lower than the highest number already used (the window tells you that number). Saving an invoice moves the next number on by itself, and **the number of a deleted invoice is not given out again**.
- **Renumber existing invoices:** lists the invoices whose number is not yet in the series of their financial year (for example 101, 102, INV-0004). Tick the ones to renumber. They are numbered **in date order**, financial year by financial year, **after the highest number already used**, and the new numbers are shown before you apply. **Drafts are ticked, sent or paid invoices are not**, because the client has the old number. Ticked invoices stay consecutive, and the old numbers go into each invoice's history.

### Things to know
- Do not delete an invoice that was sent. GST wants consecutive numbers, and a deleted number leaves a gap.
- The numbering settings are saved in their own records (collection invoiceCounters), so no database change is needed. They are part of the data backup and the restore.


## The sentence about attached documents in the invoice email

When you attach additional documents to an invoice or billing pack email (for example the PF and ESIC challans and payment receipts of last month), the **message** gets one sentence about them, after the bank details paragraph and before "Warm regards". The standard wording is: "We have also attached the PF and ESIC challans and payment receipts for October 2026, as proof that the contributions for our staff have been paid." (October if the invoice is for November: **the month before the invoice month**.)

- **Change it for this email:** the sentence is in a box under the file list. Type in the box and the message changes at once. Untick **Mention the attached documents in the message** to leave it out. **Use the original wording** goes back to the standard sentence.
- **Keep your own wording:** press **Keep this wording for every email**. It is saved and used from then on. The month name is saved as {month}, so it moves on by itself: wording saved with "October 2026" reads "September 2026" on an invoice for October. If the sentence has the file names in it, they are saved as {files} and follow the attached files.
- **If you have typed in the message yourself**, your text is never changed behind your back. A note offers the button "Add it before Warm regards". After that, changes to the sentence update it in place while your own words stay.
- With no files attached there is no sentence and the message is exactly the usual one. The payment reminder keeps the sentence too.
- Anyone who can send email can change the wording for one email and keep it as the standard. It is saved in its own record (collection emailTemplates), so no database change is needed.


## The wage register against Payroll

### Why they can differ
The **wage register** (Form XVII, in the billing pack) and **Payroll** are worked out from different things:
- The **register** is worked out from the **rate card**: for each role, Basic, D.A., Special Allowance and Washing Allowance (and Extra hours if shown) as set on the rate card, shared out by the days paid (monthly amount x days / days in the month). It does not look at what the person is actually paid.
- **Payroll** (the Pay cycle and the payslip) is worked out from **each person's own pay**: their wage or pay structure, with overtime, night shifts, arrears, additional pay and holiday work added, and PF, ESIC, professional tax, advances and other deductions taken off.

They agree when the rate card pays a role exactly what the person is paid. They differ when a person is paid more or less than the rate card for their role, or when Payroll has something the register does not (overtime, night shifts, arrears, additional pay, holiday work at more than 1 time, another deduction).

### Check against payroll
In the **billing pack** window (Invoicing, the Pack button on an invoice), choose the site, month and rate card and press **Check against payroll**. It lists every person with the days, the gross and the net pay in the register and in Payroll, marks the people who differ, and gives the **reason** in words, for example:
- "The rate card pays Rs 19,559 a month for this role, but this person is paid Rs 20,000 a month in Payroll."
- "Payroll includes overtime of Rs 1,368."
- "Holiday work is paid at 2 times in Payroll, but counted once in the register."
- "This person has no matching role on the rate card, so the register leaves them out."

A top line gives the totals and how many people differ (a difference of Rs 2 or less, from rounding, counts as a match). **Download as CSV** keeps the list. Payroll is calculated here the same way as in the Pay cycle, from the attendance as it is now. To settle a difference, make the rate card pay what the person is paid (or change the person's pay in Employees), so the register and Payroll agree.

### What changed in the register
The deductions columns now follow the same rules as Payroll: **PF** only for people who have PF, and worked out within the PF ceiling (or on the full Basic when the person is marked so), and **ESIC** only for people who have ESI, while their pay is within the ESI wage limit, on all of the pay. The rates are still the rate card's. Before, the register took PF at 12% of Basic and D.A. and ESIC at 0.75% for everyone, with no ceiling and no check of who is on PF or ESI, so its PF, ESIC and net pay could differ from the payslip even when the pay was the same.

### Please note
The register is headed "Register of Wages" and carries the Form XVII title, but it is worked out from the rate card. If it is given to a client or an inspector as the wages register, it should show what was actually paid, so use the check and settle any differences first, and ask your CA or labour consultant whether this form is relied on as the statutory register.


## The new rate structure (Karnataka, minimum wages of May 2026)

### What it is
Every new rate card now uses one structure, the **Customer billing structure (CTC breakup)** with the employee's take-home pay beside it. For one person it reads, for Zone 3, Unskilled, 8 hours:

| Line | Item | Basis | Amount |
|---|---|---|---|
| A | Basic Wage | Fixed | 19,319.36 |
| B | Variable Dearness Allowance (VDA) | Cost of living | 1,030.80 |
| C | Gross Minimum Wage (A+B) | | 20,350.16 |
| D | Employer PF Contribution | 12% on Full Basic+VDA | 2,442.02 |
| E | Employer EDLI & Admin | 1% combined | 203.50 |
| F | Employer ESI Contribution | 3.25% of Gross (C) | 661.38 |
| G | Statutory Bonus | 8.33% of Basic+VDA/Ceiling | 1,249.50 |
| H | Leave with Wages (Paid Leave) | 4.81% of Gross | 978.84 |
| I | Subtotal Statutory Cost (C+D+E+F+G+H) | | 25,885.40 |
| J | Uniform & Operational Overhead | Flat allowance | 500.00 |
| K | Total Direct Cost, TDC (I+J) | | 26,385.40 |
| L | Agency Service Charge | 8% of TDC (K) | 2,110.83 |
| M | Subtotal Before GST (Total CTC) (K+L) | | 28,496.23 |
| N | GST | 18% on Subtotal (M) | 5,129.32 |
| O | Total Monthly Invoice Amount, Final Billing per Head (M+N) | | 33,625.55 |

Employee take-home: Gross wages 20,350.16, less employee PF 12% (2,442.02) and ESI 0.75% (152.63), **final estimated net pay 17,755.51**. A professional tax line appears only when the pay is high enough for it to apply.

Every amount is worked out to the paisa, line by line in this order, and the lines add up exactly. Bonus is 8.33% of the **Basic + VDA, or the bonus ceiling if that is lower** (15,000 to begin with), the same base the bonus ledger uses for each person. PF and EDLI are on the full Basic + VDA (or up to a PF ceiling if you enter one). ESI applies while the monthly wage is within the ESI limit (21,000). A role on a **12-hour duty** gets two extra lines (Extra 4 hrs, Total Wages) and the ESI and leave lines then follow the total wages; for an 8-hour role they do not appear.

### Amounts that change from customer to customer
Open **Rate Card, New rate card** (or the phone app, New card, Rates and options) and change, for that customer:
- **Uniform & operational overhead** (500 to begin with), **Washing allowance** and **Special allowance** (0 to begin with). They are flat amounts per person per month, billed as their own lines after the statutory costs, so **PF, ESI, bonus and leave are not worked out on them**, and the service charge is. The washing and special allowance lines appear in the table only when they have an amount, and the letters of the lines after them move on.
- **Service charge %** (8 to begin with), and also EDLI & admin %, bonus % and ceiling, leave %, PF %, ESI %, GST %.
- On the **phone app**, the **email window has "Service charge %"** at the top: change it just before you send, and the message to the client and the PDF follow it, with the total per person shown under the box.
Washing and special allowance are billing amounts only. They are not added to the employee's pay in Payroll (use Additional pay there if the staff are to receive them).

### When the minimum wages change
Enter the new Basic for each zone and skill, and the VDA, in the **minimum wages table in Compliance**. Then press **Update wages from the minimum wages table** on the Rate Card tab: it sets Basic and VDA of every role that has a skill category, in every new-structure card, to the table (it asks first and says how many roles change). Roles without a skill category, and cards in the old structures, are not touched, and invoices already made keep their amounts. A new card takes the table's wages by itself.

### The old structures
The two earlier structures (cost sheet, and the 14-line wage break-up) are no longer offered for new cards. Cards already made with them stay in the list marked **old structure** and keep working, so invoices, billing packs and wage registers made from them do not change. Open one and press **Make a copy in the new structure** to get a new card with the same client, zone, roles, service charge and GST, and the uniform, washing and special amounts it had. In the phone app the copy comes up on screen to check and save. A contract that uses an old card keeps using it until you choose the new card on the contract. Delete the old cards when you no longer need them.

### The rest of the system follows
- **Rate card PDF:** "Monthly Wage Structure", with a band such as KARNATAKA - ZONE 3 - UNSKILLED, the table above for each role, notes, and the signature.
- **Wage register (Form XVII) in the billing pack:** new columns for this structure (Basic, VDA, Gross Min. Wage, PF, EDLI & Admin, ESI, Bonus, Leave, Statutory Cost, Uniform, Washing, Special, Direct Cost, Service Charge, Total CTC, GST, Total Billing, then the employee's PF, ESI, PT, Advance, Total Deduction and Net Pay), in rupees and paise, with a grand total.
- **Invoices made from a contract** take each person's Total Direct Cost for the days worked (flat amounts included), add the service charge from the rate card and GST, so the invoice agrees with the register.
- **Check against payroll** works for the new structure as before. The register now decides ESI by the regular monthly wage, as Payroll does, so an extra duty no longer makes one of them drop ESI.


### The signature on the rate card
Every rate card PDF, whether it is downloaded for the client or sent by email (from the main system or the phone app), now carries the **authorised signatory's signature image** above the signature line, under "For PUBLIC FORCE SECURITY SERVICES", with "Authorised signatory, Sharath R, Accounts Head" beneath. It uses the signature image and the name and designation saved in **Settings, Authorised signatory, signature and stamps**, the same as on invoices and payslips. This applies to the new structure and also to the old-structure cards. If no signature image has been saved, the card shows the blank signature line as before. To add or change it, open Settings, choose the signature photo, and press Save: sign with dark ink on plain white paper and take a photo, and the paper is removed and the picture cropped on its own. The phone app reads the same saved signature.

The card stays on one page where it can: when the table, the notes and the signature would not fit, the rows are made a little tighter (a card with the washing and special allowance lines still fits on one page), and a very long card moves the notes and the signature together to the next page. A long label such as the final total now wraps onto two lines instead of being cut off.


### The signature on the rate card PDF
- **Downloaded or shared:** the rate card PDF (the Download PDF button in the Rate Card tab and in the phone app, and Share on the phone) carries the **signature image** saved in Settings, above the line, with "For PUBLIC FORCE SECURITY SERVICES" over it and just **"Authorised signatory"** under it. The name and the designation are not printed.
- **Emailed from the phone app:** the PDF that goes with the email has **no signature**. In its place it says "This is a computer-generated rate card and does not require a signature." (The footer of every rate card also reads "Computer-generated rate card".)
- If no signature image has been saved in Settings (Authorised signatory, signature and stamps), the downloaded PDF has a blank signature line, as before.
- This applies to every rate card PDF, in the new structure and in the two old ones. Invoices, payslips and letters are not changed.
- The notes and the signature stay on the same page as the table whenever they fit: rows are made slightly tighter when needed, and only a card that is still too long moves the notes and the signature to a second page.


## Two kinds of client: a rate for the full month, and a rate per day (8 hours x 26 days)

Some clients pay a **fixed amount for the month**. Others have a rate for **8 hours x 26 days** and pay for **every day** of the month: for a monthly amount of 26,000 that is 26,000 for 26 days, **30,000 for 30 days and 31,000 for 31 days**. Both kinds can be in use at the same time. How a client is billed is set **on its rate card**, and **the pay type of the people at that client must follow it**.

| | Rate for the full month (the default) | Rate per day (8 x 26) |
|---|---|---|
| **Rate card, "Bill by"** | Fixed monthly amount | Per day |
| **What the client pays** | The same amount in every month for a full month, for example 26,000 in a month of 28, 30 or 31 days. A part month is pro-rata by the days of the month. | The monthly amount divided by the days per month on the card (26), for each day paid: 26,000 for 26 days, 30,000 for 30 days, 31,000 for 31 days. |
| **Pay type of the people** | **Monthly wage.** The same pay every month. An absent day takes off one day of the month (wage divided by the days of the month). | **Daily wage** (the monthly amount divided by 26, a day's pay). Pay is the daily wage x the days paid: 28 days, 30 days or 31 days of pay. |
| **Wage register and invoice** | The share of the monthly structure for the days paid out of the days of the month. | The share of the monthly structure for the days paid out of the 26 days, so 30 days paid is 30/26 of it. |

- **Days paid** are all the days of the month except days absent without pay, so weekly offs and holidays are paid, and extra duties are added (the setting "Count extra duties in client billing" decides whether they are billed).
- **Where to set it:** the rate card (Rate Card, open the card, the box "How the client is billed for the days"; on the phone app, Rates and options, "Bill by"). Every existing rate card stays "Fixed monthly amount", so nothing changes until you choose Per day for a card. A new card also starts as fixed monthly. The contract of the client must use the right card. The per-day basis is available for rate cards in the new structure.
- **You can see it everywhere:** a per-day card is tagged "billed per day" in the Rate Card list and "(billed per day)" in every list where a rate card is chosen (billing pack, email, contract, client). The rate card table is followed by a line saying each day paid is billed at 1/26, the PDF has a note ("a 30-day month is billed 30/26 of the amounts and a 31-day month 31/26"), the email message from the phone app says it too, and the wage register has a line at the foot.
- **A pay type that does not follow the billing is flagged:** in the pay cycle checks (a warning, which does not stop the payroll), "The client (card) is billed per day, but this person is paid a monthly wage" and "The client (card) is billed a fixed monthly amount, but this person is paid a daily wage". The warning looks at the contract of the person's site and the role on its rate card. **Check against payroll** in the billing pack says the same in words ("Set their pay as a daily wage of 782.70 to match") and shows the difference per person.
- **For a daily-wage person** the Basic + D.A. box in the employee record should hold the same amount as the daily wage, so that PF is worked out on the whole wage.
- **ESI, to confirm with your consultant:** the pay cycle decides each month whether ESI applies from that month's pay. A daily-wage person paid for 31 days can cross the ESI limit in a long month although the pay for 26 days is below it. ESIC rules decide coverage for a whole contribution period, so ask your CA or ESIC consultant how you want this treated; it is not changed here.


### Professional tax in the rate card
The employee take-home block of the new structure (screen, PDF and phone app) now **always has a Professional Tax line**, between Employee ESI and the Final Estimated Net Pay. It is worked out from the **Professional Tax slabs in Compliance** for the state of the rate card, on the gross wages (the Total Wages when a role has extra hours), and it is taken off the net pay. The basis column says how it works, for example "₹200 from ₹25,000 gross" for Karnataka. It shows a dash while the wages are below the first taxed slab, and ₹200 from ₹25,000 (so, for example, for a 12-hour guard or a skilled role). If a state has several slabs it reads "As per the (state) slab", and if it has none, "No professional tax in (state)". It is a deduction from the employee, so it is not part of the billing lines and does not change the amount the client pays. To change the amounts, change the slabs in Compliance. In the PDF the rupee sign is written "Rs." so that it always prints. The wage register has its own PT column in the deductions, as before.


### Special allowance in the net pay of the wage register
For a rate card in the new structure, the **wage register adds the special allowance to the employee's Net Pay**: Net Pay = wages + special allowance - deductions. The last column then reads **Net Pay incl. Special** (when the card has a special allowance), and a note under the table gives the formula. The special allowance is for the days paid like the other lines (so 30/26 of it on a per-day card for 30 days).
- It is **not part of the PF and ESI** (it is a flat amount like the uniform), and **professional tax is worked out on the wages plus the special allowance**.
- **Washing allowance is not added to the net pay.** It is a billing amount only. Tell me if it should be treated the same way.
- **Payroll does not pay the special allowance by itself.** For the register to be true, give each person at that client the special allowance in the pay cycle as **Additional pay, type Allowance** (Pay cycle, step 1, Attendance and shifts, "Additional pay"). Untick the ESI and PT box of that line if you want it left out of ESI and professional tax, as in the register.
- **Check against payroll** (the billing pack) now counts the special allowance in the register's gross and net. A person whose special allowance has not been paid in Payroll shows as different, with the reason "The register adds the special allowance of ... to net pay, but Payroll has not paid it. Add it for the person as Additional pay (Allowance) in the pay cycle." When it has been paid, the person agrees, and the additional pay is not reported as an extra.
- The rate card's own **Employee take-home pay block is unchanged**: it still shows the wages less PF, ESI and professional tax, without the special allowance. Registers and cards in the old structures are also unchanged.


## Statutory bonus: accrued with each payroll, saved, paid once a year

The bonus is paid to the employees once a year, so the system **works out each person's bonus in every payroll and saves it**, and adds the months up for the year.

### How it is worked out
For each person in each payroll: **8.33% of the Basic + D.A. earned in the month**, where the Basic + D.A. counted is **capped at 15,000 a month for the days paid** (the ceiling is scaled by the days paid out of the days of the month, as on the rate card, so extra duties raise it and absent days lower it). Example, October (31 days), Basic + D.A. above 15,000: full month 8.33% of 15,000 = **1,249.50**; 29.5 days paid 8.33% of 14,274.19 = **1,189.04**; 32 days paid (an extra duty) 8.33% of 15,483.87 = **1,289.81**. These are the same figures as the Bonus column of the wage register and the Statutory Bonus line of the rate card. Overtime, night shifts, arrears and additional pay are not part of it.

### Where it is saved and where you see it
- **Saved with the payroll:** when a payroll is calculated, every line carries the bonus base, the percentage and the bonus. When the payroll is **approved**, those figures are part of the approved payroll for good. A payroll that is sent back, or calculated again, is not counted until it is approved again.
- **Each month, in the pay cycle:** the **Reports** step has the card **"Bonus accrued"** for the month, each person and the total, with a **Download (CSV)** button.
- **For the year: Compliance, Bonus ledger.** Choose the **financial year (April to March)**: one row for each person, a column for every month, and the **total for the year**, with a total row and **Download (CSV)**. Only approved payrolls count, every group's payroll is included, and a month that is not approved yet shows a dash. This is the figure to pay from at the end of the year.
- **Payrolls approved before this was added** have no bonus figures. The ledger says how many lines are missing and offers **Work them out and save**: the bonus is then worked out again from the records as they stand now and saved in those payrolls (marked as worked out later). Check the months once before relying on them.

### Settings
- **Settings, "Overtime, night shifts and employer ESIC": Statutory bonus %** (8.33) and **Bonus wage ceiling per month** (15,000, or 0 for no ceiling). A change applies to the next calculation: calculate the month again to refresh a month that is not approved. Figures already saved in approved payrolls are not changed.
- **In each employee record: "Statutory bonus applicable"** (ticked to begin with). A person who is not ticked gets no bonus in the payrolls from then on.

### Please note
- The bonus is **not added to the monthly pay, the payslip or the net pay**: it is a saving for the year-end payment. Paying it (and recording that it was paid) is not part of the ledger yet.
- The Payment of Bonus Act has its own rules on who is eligible and on the wage the bonus is worked out on. The system accrues for everyone who is ticked, at the percentage and ceiling in Settings, so please confirm both with your CA before you pay.


## The payslip as a wage slip (grid layout)

Payslips (the single payslip and the all-payslips PDF) now come in the layout of a statutory **wage slip**: grids of labelled cells, as in a wage slip of the contract-labour kind.

### What is on it
- **Title block:** "PAY SLIP FOR THE MONTH OF OCTOBER - 2026", the **establishment** (the client and the site, found from the contract of the site), and a **heading** line, "Wage Slip - Form XIX [See Rule 78 of the Contract Labour (Regulation and Abolition) Rules]".
- **Employee grid:** name, father's name, date of birth, employee code, date of joining, designation, bank and account number, site, PAN, **Aadhaar (printed masked, XXXX XXXX 1234)**, UAN, ESI number, the company's PF number and the IFSC.
- **Days block:** Workable Days, Worked Days, LOP / LWOP, Half Days, Present Days, Week Offs, Holidays, Paid Leaves, OT Days (extra duties and work on offs), Total Days and the wage period. Worked Days are the days paid (present + week offs + holidays + paid leave + half days at half); Total Days add the OT days.
- **Earnings table:** Pay Heads, **Rate** (the monthly rate, or the daily rate marked "/day" for a daily wage) and Current Month Amount: Basic and D.A. (or Basic + D.A. and Other allowance), extra hours, extra duty, holiday work, overtime, night shift, arrears and additional pay lines, with Total Earnings.
- **Deductions table:** only the deductions that apply (PF, ESI, professional tax, salary advance, other), with Total Deductions.
- **Net Pay** in figures and **in words**, the employer contributions line, the notes on pay revisions and arrears, the **electronic approval stamp with its reference** and the signature lines, as before.

### Settings
**Settings, "Overtime, night shifts and employer ESIC": Payslip layout** (wage slip with grids, which is the new standard, or the earlier simple payslip) and **Heading of the wage slip**, which you can change if the heading should read differently. The form number and rule in the heading are for the contract-labour wage slip (Form XIX); the sample you gave carries the form number of its own state's rules. Please confirm the wording with your CA or labour consultant.

### Good to know
- The days and the monthly rates are **saved with each payroll when it is calculated**. A payroll approved before this layout has no day counts: its slips still print, with "Pay for days worked" in one line, a dash where a figure was not saved, and the workable, worked and LOP days that are known. Calculate such a month again if you want the full slip (a month that is already approved has to be reopened first).
- **Bonus is not on the slip:** it is paid once a year (see the bonus ledger), and the leave and week-off wage lines of the sample are part of the monthly wage here.
- Casual, sick and earned leave are not kept apart: they appear as **Paid Leaves**. Late-day deductions are not used.


### How the duty is described on the rate card PDF (for example 9*26)
The wages are worked out for the **duty hours of each column** (8 or 12). If the duty is longer on paper, for example **9 hours including a 1 hour break**, you can change what the PDF says without changing any amount. Both texts can be changed whenever it is needed, for a new card or an existing one (new structure only):
- **"Duty shown on the PDF" under each column** (in the column's box in the main system, and in each column on the phone app). Type for example **9*26**; the PDF and the preview then print "9*26" under that column's name instead of "8 Hrs. Duty". There is a list of suggestions (8*26, 9*26, 12*26, 8*30, 9*30), and any other text can be typed. Empty means the usual "8 Hrs. Duty" or "12 Hrs. Duty". Each column has its own, so a 9-hour housekeeping column and a 12-hour guard column can say different things.
- **"Duty note under the table"** (one for the card; in the box "How the duty is described on the PDF" in the main system, and in Rates and options on the phone app). It replaces the first sentence of note 3 ("Wage calculation is considered for 8 working hours per day and 26 working days per month."), for example "Duty is 9 hours per day including a 1 hour break, 26 days per month (9*26)." The notes about extra hours and about billing per day are still added after it when they apply. Empty means the usual sentence.
- The texts are saved with the rate card, in the main system and from the phone app, and the phone app keeps them when it saves a card made in the main system. The message to the client from the phone app uses the column text too ("Security Guard / Lady Guard (9*26 duty): Rs. ...").
- **No amount changes:** the hours used for the wages, the extra hours line of a 12-hour duty and the billing basis stay as set in the duty box (8 or 12 hrs duty) and "Days per month".


### The bonus base is Basic + VDA (correction)
The Statutory Bonus line of the rate card (and so of the wage register and of the invoice amounts for the new structure) was worked out on the **Basic alone**, up to the ceiling. It is now worked out on the **Basic + VDA, or the bonus ceiling if that is lower**, the same base that Payroll uses for the bonus ledger. The line now reads "8.33% of Basic+VDA/Ceiling". With the ceiling at 15,000 nothing changes in the figures, because Basic is already above it (for example Zone 3, unskilled: 8.33% of 15,000 = 1,249.50). The figures change only where the ceiling is above the Basic, or is left at 0 for none: for example with a ceiling of 20,000 the unskilled Zone 3 line is 8.33% of 20,000 = 1,666.00 (it was 1,609.30), and with no ceiling it is 8.33% of 20,350.16 = 1,695.17 (it was 1,609.30). Rate cards already saved are worked out again with the new base when they are opened or used; invoices and registers already made keep their amounts.


## Invoices with the amounts typed by you (no calculation)

Some clients have an invoice with figures of their own, for example a line for the housekeeping bill, then PF, ESI and the service charge as separate lines with their own amounts, then the Total, SGST, CGST and the final total. For these, the invoice can be made **with every amount typed by you and nothing worked out**.

### How to use it
- **For one invoice:** Invoicing, New invoice (or open an existing one), and tick **"Type all the amounts myself (no calculation)"** at the top. The boxes that calculate (contract lines, service charge %, GST %) are hidden, and the typing boxes appear. Unticking brings the calculating form back, and ticking again brings back what was typed.
- **For a client, once:** Invoicing, the client's **Edit**, tick **"Type this client's invoice amounts myself"**. Every new invoice for that client then starts with the tick on, with one empty row and two tax rows (SGST 9%, CGST 9%) ready. Other clients are not affected.

### What you type
- **Rows:** Description (two lines are allowed, press Enter), **HSN/SAC**, **Quantity**, **Rate**, **Per** and **Amount**, each exactly as it should print. A row can be only a description and an amount (such as "PF Employer's 13%" 1,950.00 or "Service Charge @7% on 14216.00" 995.00). A box left empty prints nothing. **+ Add row** adds more.
- **Total, before tax**, and the **GST rate for the GST return** (for example 18).
- **The rows after the Total:** a label and an amount for each (for example SGST 9% 1,765.00 and CGST 9% 1,765.00). The buttons **+ SGST and CGST**, **+ IGST** and **+ Another row** add them.
- **Invoice total.**

To save, an invoice needs at least one row with a description, the Total (before tax) and the Invoice total.

### Nothing is worked out
The amount is not rate times quantity, there is no service charge line made by the system, the GST is not calculated (1,765 and 1,765 stay as typed, not 1,764.54), there is no round-off line, no reverse-charge text and no TDS figure. The only help is a small remark in amber, for example "The rows add up to ... but the Total you typed is ...", when the typed figures do not agree with each other. It never changes a figure, and the invoice can still be saved.

### Where the typed figures go
- **The PDF** has the columns #, Description, HSN/SAC, Qty, Rate, Per and Amount, the Total, the tax rows and the **Invoice total** as typed, with the amount in words from the typed total. The Document ID and QR code (once saved) cover every typed figure, so changing one changes the ID.
- **The lists and the money owed** use the typed Invoice total.
- **GST for the month (GSTR-1):** the taxable value is the typed Total and the tax is taken from the tax rows by their label: a label with "CGST", "SGST" (or "UTGST") or "IGST" goes to that tax; any other label is added to the GST amount but not to the split. The rate is the typed GST rate. The invoice is a normal sale: it is not treated as reverse charge.
- The amounts on a typed invoice are not checked against a rate card or a contract, and **Generate lines** and **Load from rate card** work only on the calculating form. Invoices made before are not changed.
- Because nothing is checked, **the GST amounts typed are what goes in the GST return**: please make sure they are right.


## SAC code for each client and each invoice

Different clients get different services, so the SAC code (and the description of the service) is no longer one setting for every invoice.

### Where to set it
- **For a client, once:** Invoicing, the client's **Edit**: **Default SAC code** and **Service described on its invoices**. Choosing a code from the list fills the service for you (for example 998533 gives "Housekeeping (general cleaning) services"); any other code or wording can be typed.
- **For one invoice:** in the invoice window, below the totals and above the Notes: **SAC code** and **Service described on the invoice**. A new invoice starts with the code and service of its client (and changes with them if you change the client on a new invoice). An invoice that is already saved keeps its own. Change either box when an invoice needs something different; if you change the code and have not typed the service yourself, the service follows the code.
- **For everyone else:** Settings, **Default SAC code**, still applies when neither the client nor the invoice has its own. Nothing changes for clients and invoices that do not have one.

### The suggestions
998525 Guard services, 998533 General cleaning services (housekeeping), 998513 Contract staffing services, 998514 Temporary staffing services, 998529 Other security services, 998531 Disinfecting and exterminating services, 998532 Window cleaning services. They are only suggestions: type any code. Please ask your CA which code fits each service you supply.

### Where it goes
- **The invoice PDF** prints the code and the service in the supplier block (also for invoices with the amounts typed by you, where each row has its own HSN/SAC box as well).
- **GST for the month, Table 12 (SAC summary):** one row for each SAC code (and for B2B and B2C), with its taxable value and taxes, so invoices with different codes are listed separately. The description is the official name of the code when it is one of the above. **The invoice list (CSV)** has a new **SAC** column.
- **The Document ID** covers the code and the service of an invoice that has them, so changing the SAC code of a saved invoice changes its Document ID, like any other change (if the invoice was already issued or filed, the client's copy and the GST return then need correcting too). **Invoices made before this existed** are not touched: they show the default code, and saving one without changing anything does not store a code or change its Document ID.


## One version line
The page used to show two version lines: an old one under the name ("Build 5 Nov 2026 · 44", which was never updated) and the real one at the bottom of the menu. The old one is removed. There is now a single line, **under "Public Force" at the top of the left menu**, such as "Version: 10 Nov 2026, build 28". It is the line to check after an upload (press Ctrl + Shift + R first): if it shows an older build, the new file is not live yet.


## Paying the bonus at the year end (bonus ledger)
The Bonus ledger (Compliance, Bonus ledger) now also records what has been paid, so it shows for each person the bonus, **Paid** and **Balance**, with a summary (bonus, paid, still to pay) above the table.
- **One person:** the **Pay** button on their row opens a window with the date (today), the amount (the balance, which can be changed for a part payment), how it was paid (bank transfer, cash, cheque or UPI) and a note. A person with payments has a button "1 payment" that lists them, with **Remove** for a payment entered by mistake. A payment of more than the balance asks first.
- **Everyone:** **Record the year-end payment** records each person with a balance as paid that balance on the date you choose (it asks to confirm the total).
- **Download (CSV)** has Paid, Balance and Last paid on.
- Payments are kept for each financial year and each person (collection `bonusPayments`), and are part of the backup. **Only Accounts or an administrator** can record or remove a payment (the database enforces it: **run `supabase/accounts_role.sql` once in the Supabase SQL Editor** for this and for the "Special allowance applicable" tick below).
- Recording a payment here does not move money or make a bank file: it is the record of what was paid. The bonus is not shown on the payslip.

## Special allowance paid with the payroll (automatic)
For a person at a client whose rate card (new structure) has a **special allowance**, Payroll now **adds it by itself as additional pay (type Allowance, "Special allowance")**, for the days billed: the amount of the card times the days billed over the days of the month (or over the days per month of the card for a client billed per day), the same amount as in the wage register. It is not part of PF, ESI or professional tax, it is on the payslip as "Allowance - Special allowance", and **Check against payroll** now agrees with the wage register without anything typed by hand. This replaces the earlier advice to type it in as additional pay.
- The Calculate step says how many people got it and the total.
- **Settings, "Pay the special allowance of the client's rate card with the payroll"** switches it off for everyone, and the employee form has **"Special allowance applicable"** (ticked to begin with) to stop it for one person. Washing allowance and uniform are billing amounts only and are never added to pay.
- **If you had already typed the special allowance in as additional pay, remove those lines**: the Validate step gives a warning for each person who has it both ways, because it would be paid twice. A month that was already calculated is not changed until it is calculated again.
- The rate card's own take-home block still leaves it out.

## Switching the people of a per-day client to a daily wage
**Employees, Change pay for many employees** (the tool for dated pay changes, for the administrator) has two new choices in **Change**:
- **Switch to a daily wage from the rate card (clients billed per day):** the daily wage is the wages of the rate card (Basic + VDA, and the extra hours of a 12-hour duty) divided by the days per month of the card (26), so Payroll and billing match.
- **Switch to a daily wage from the present monthly pay:** the daily wage is the present monthly pay divided by the days per month of the card, so what a person earns for a full month stays the same.
Only people at a client whose rate card is billed per day are listed (use the Site and Role boxes to narrow it). People already on a daily wage are listed without a tick box. Choose the date it starts from, the reason and a note, tick the boxes of the people, and apply. It is a normal **dated pay change**: the earlier months keep the monthly pay, the pay history shows "Pay type" (not a percentage), the daily wage is shown with paise, and a pay revision letter says the way the wages are calculated changes and that the pay for a full month is not reduced. A change of pay type with the same monthly total is now accepted by the pay change tool (it used to be refused as "the same as the present pay"), and a difference of less than a rupee in the monthly total is not treated as a pay cut.
- **Basic + D.A. in the employee record is not part of a dated change**, so it is left as it is. Where it is empty, PF is worked out on 50% of the pay: the list says so in the last column. For a daily-wage person it should equal the daily wage.

## Rate card PDFs made on the phone
Every rate card PDF made in the phone app (download, share and email) is now the **computer-generated version**: no signature image, no signatory line, and the line "This is a computer-generated rate card and does not require a signature." The rate card downloaded in the main system still carries the signature.


## Site locations, Map and Directions links, and the Dashboard map

### Giving a site its location
**Dashboard, the "By site" table, column Location: "Set location"** (or **Edit** once it has one). The window accepts any of these, and shows what it understood before you save:
- a **Google Maps link** that has the place in it (the address bar of a place opened in Google Maps: it contains an @ and two numbers, or !3d..!4d.., or ?q=latitude,longitude);
- **coordinates**, for example `13.0827, 77.5877` (in Google Maps, right-click the place and click the numbers to copy them);
- the phone's own position: **Use my location**, pressed on a phone standing at the site;
- an **address**: the Map and Directions links then work, but there is no pin on the map until coordinates are added.
A short link (maps.app.goo.gl) cannot be read: the window says how to get the full one. An optional **address or landmark** is shown on the pin. **Remove the location** deletes it. Anyone who can edit can set a location. Locations are kept in the collection `siteLocations` and are part of the backup.

### Map and Directions links
Wherever a site is shown, a small **Map · Directions** pair appears when the site has a location: the Dashboard table, the Employees list, the Contracts list, and under the Site box of Attendance and of the Duty Roster. They open Google Maps (the place, or the route to it) in a new tab. This needs no account, no key and costs nothing.

### The Dashboard map
A **Site map** card (OpenStreetMap, free, no key, no billing) shows a pin for every site that has coordinates, for people who can edit. **Click a pin** for the site, its client, the note, how it is staffed, the overdue amount if any, and Directions and Open in Google Maps. Colours: **green** fully staffed, **amber** short of staff, **red** nobody deployed, **grey** no requirement set; a **dark ring** means the client has an overdue invoice. A line under the map names the sites that have no pin yet.
- **"Required"** for a site is the day plus night requirement set for the Duty Roster (Settings), or if there is none the number of people in the positions of its contracts. **Deployed** is the number of active employees at the site (it is not today's attendance). The "By site" table now lists every site, also those with nobody deployed, with a coloured dot, the Required number and the location links.
- **The ring is by client**, because invoices are not made per site: every site of a client with an overdue invoice has it. The rule is the one of the Overdue count (not paid, due date passed).
- The map libraries and the map tiles are loaded from the internet only when the Dashboard is shown, so the map needs internet access. Without it the card says so and the table still works. It does not appear in the preview made inside Claude, only on your own site.

### Upload `public/_headers` too
Your site's `_headers` file had **`geolocation=()`**, which stops "Use my location" from working. It is now **`geolocation=(self)`**, which allows it for your own site only. Upload `public/_headers` with `public/index.html`, or the button will say the location was not allowed (pasting a link or coordinates still works). The map tiles send only the site's address as the referrer, as OpenStreetMap requires.

### Please note
Client premises and where guards are posted are sensitive. The map and the location boxes are for people who can edit only, and the site stays behind the sign-in. OpenStreetMap's servers see which part of the map is looked at, and the address of the viewer, as any website that shows a map.
