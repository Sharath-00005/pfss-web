# Public Force Security Services: HR, payroll, compliance and billing

A website with staff sign-in. Nobody can see any data without an account, and each account has a role.

| Role | Can do |
|---|---|
| admin | Everything, including settings and staff roles |
| manager | Read and write all records except settings (HR, payroll, accounts) |
| viewer | Read only |
| disabled | Nothing |

Files:

- `index.html`: the app
- `pfss-backend.js`: sign-in screen, database and file storage connection
- `config.js`: your Supabase address and key (you fill this in)
- `supabase/schema.sql`: tables and access rules
- `supabase/seed_from_claude.sql`: your current data, to import once (kept out of git)
- `_headers`: security headers for Cloudflare Pages and Netlify

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
1. **Project Settings > API**: copy the **Project URL** and the **anon public** key into `config.js`. Never use the `service_role` key.
2. Test on your computer: in the folder run `python3 -m http.server 8000`, open http://localhost:8000, sign in.

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
2. Publish with **Cloudflare Pages** or **Netlify** (both free and work with private repos): connect the repository, leave the build command empty and set the publish folder to `/`.
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
