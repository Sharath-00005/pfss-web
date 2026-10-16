// @ts-nocheck
// Supabase Edge Function: send-ratecard
//
// Sends a rate card PDF by email from one of the company addresses (info@, accounts@, hr@ ...).
// The mobile app builds the PDF on the phone and posts it here. The email key (Resend) never leaves this function.
//
// WHO CAN USE IT   Signed-in staff whose role is admin or manager.
// WHAT IT CHECKS   The sending address must be on the allowed list. At most 5 recipients and 5 CC addresses.
//                  The attachment must be a PDF under about 3 MB. At most 60 emails per person per day.
// WHAT IT KEEPS    A log row for every email (who sent it, from which address, to whom, subject).
//
// SETTINGS (Supabase > Edge Functions > Secrets)
//   RESEND_API_KEY    required. Your Resend API key (starts with re_).
//   ALLOWED_SENDERS   optional. Addresses staff may send from, as  email|Label;email|Label
//                     Default: info@, accounts@ and hr@publicforcesecurity.com
//   DAILY_LIMIT       optional. Emails per person per day. Default 60.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_SENDERS =
  "info@publicforcesecurity.com|Public Force Security Services;" +
  "accounts@publicforcesecurity.com|Public Force Accounts;" +
  "hr@publicforcesecurity.com|Public Force HR";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const EMAIL_RE = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function parseSenders(raw) {
  return String(raw || DEFAULT_SENDERS).split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const parts = x.split("|");
    return { email: parts[0].trim().toLowerCase(), label: (parts[1] || "Public Force Security Services").trim() };
  });
}
function cleanLine(s) { return String(s == null ? "" : s).replace(/[\r\n]+/g, " ").trim(); }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function listEmails(v, max) {
  const arr = Array.isArray(v) ? v : String(v || "").split(/[,;\s]+/);
  const out = [];
  for (const a of arr) {
    const e = cleanLine(a).toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e)) throw new Error("This is not a valid email address: " + e);
    if (out.indexOf(e) < 0) out.push(e);
  }
  if (out.length > max) throw new Error("Too many addresses. The most allowed is " + max + ".");
  return out;
}
function buildHtml(message, sender) {
  const paras = esc(message).split(/\n{2,}/).map((p) => '<p style="margin:0 0 14px">' + p.replace(/\n/g, "<br>") + "</p>").join("");
  return '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#232323;line-height:1.55;font-size:15px">' +
    '<div style="border-bottom:3px solid #C9973A;padding:10px 0;font-weight:700;font-size:16px;letter-spacing:.3px">PUBLIC FORCE SECURITY SERVICES</div>' +
    '<div style="padding:18px 0 4px">' + paras + "</div>" +
    '<div style="border-top:1px solid #ddd;margin-top:18px;padding-top:12px;font-size:12px;color:#666">' +
    "Public Force Security Services, No. D1-344, 1st Floor, Maruthi Complex, 407 SFS, 4th Phase, Yelahanka New Town, Bengaluru 560064<br>" +
    "GSTIN 29AQEPK6324M1ZG | " + esc(sender.email) + " | +91 99860 20293</div></div>";
}
function buildText(message, sender) {
  return String(message) + "\n\n--\nPublic Force Security Services\nNo. D1-344, 1st Floor, Maruthi Complex, 407 SFS, 4th Phase, Yelahanka New Town, Bengaluru 560064\nGSTIN 29AQEPK6324M1ZG | " + sender.email + " | +91 99860 20293";
}

async function handle(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, service);

  // 1. who is calling
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const who = token ? await admin.auth.getUser(token) : null;
  const user = who && who.data && who.data.user;
  if (!user) return json({ error: "Please sign in again." }, 401);
  const prof = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = prof && prof.data && prof.data.role;
  if (role !== "admin" && role !== "manager") return json({ error: "Only administrators and managers can send email." }, 403);

  const senders = parseSenders(Deno.env.get("ALLOWED_SENDERS"));
  if (req.method === "GET") return json({ senders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body;
  try { body = await req.json(); } catch (e) { return json({ error: "The request could not be read." }, 400); }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("Email is not set up yet: the RESEND_API_KEY secret is missing.");
    const sender = senders.find((s) => s.email === String(body.from || "").toLowerCase());
    if (!sender) throw new Error("That sending address is not allowed.");
    const to = listEmails(body.to, 5);
    if (!to.length) throw new Error("Enter at least one recipient.");
    const cc = listEmails(body.cc, 5);
    const subject = cleanLine(body.subject).slice(0, 200);
    if (!subject) throw new Error("Enter a subject.");
    const message = String(body.message || "").slice(0, 5000);
    let filename = cleanLine(body.filename).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "RateCard";
    if (!/\.pdf$/i.test(filename)) filename += ".pdf";
    const b64 = String(body.pdfBase64 || "");
    if (!b64) throw new Error("The PDF is missing.");
    if (b64.length > 4000000) throw new Error("The PDF is too large to email.");
    if (b64.indexOf("JVBER") !== 0) throw new Error("The attachment is not a PDF.");

    const limit = Number(Deno.env.get("DAILY_LIMIT")) || 60;
    const since = new Date(Date.now() - 86400000).toISOString();
    const recent = await admin.from("documents").select("id", { count: "exact", head: true })
      .eq("collection", "emailLog").eq("data->>by", user.id).gte("updated_at", since);
    if ((recent && recent.count || 0) >= limit) throw new Error("The daily email limit has been reached. Try again tomorrow.");

    const payload = {
      from: sender.label + " <" + sender.email + ">",
      to: to, reply_to: sender.email, subject: subject,
      html: buildHtml(message, sender), text: buildText(message, sender),
      attachments: [{ filename: filename, content: b64 }],
    };
    if (cc.length) payload.cc = cc;
    if (body.keepCopy) payload.bcc = [sender.email];

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("The email service did not accept it: " + (out.message || res.status));

    await admin.from("documents").insert({
      collection: "emailLog", id: crypto.randomUUID(),
      data: { at: new Date().toISOString(), by: user.id, byEmail: user.email, from: sender.email, to: to, cc: cc, subject: subject, filename: filename, resendId: out.id },
    });
    return json({ ok: true, id: out.id });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 400);
  }
}

Deno.serve(handle);
