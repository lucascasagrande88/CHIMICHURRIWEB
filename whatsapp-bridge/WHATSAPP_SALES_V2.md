# CHIMI WhatsApp Sales V2

Status: PREPARED, NOT DEPLOYED
Date: 2026-09-07

## Purpose

Add a customer-facing WhatsApp sales lane without modifying the existing Lucas <-> CHIMI agents bridge.

Existing owner lane stays unchanged:
- `api/send-whatsapp.js` -> agent/runtime outbound to Lucas.
- `api/whatsapp.js` -> Lucas inbound to CHIMI agent AI.

New sales lane:
- `api/send-sales-whatsapp.js` -> authenticated Sales-only outbound to an explicit customer number.

## Safety / delivery gates

The new endpoint refuses delivery unless all of these are true:
1. Caller is authenticated with CHIMI bridge token or canonical `2_CHIMICHURRI_SALES` runtime token.
2. Recipient is valid E.164.
3. WhatsApp consent is marked `VERIFIED` and includes `source` + `verified_at`.
4. If the customer has messaged within the last 24h, free-form text is allowed.
5. Otherwise an approved Twilio/WhatsApp `ContentSid` is mandatory.

It supports `dry_run: true` so Sales can validate a record without sending it.

## Runtime environment needed

Keep current owner variables. Add only:

`TWILIO_WHATSAPP_SALES_FROM=+549XXXXXXXXXX`

The Twilio Account SID/Auth Token can remain the existing account credentials if this sender is registered in that account.

Do NOT place credentials in GitHub or Drive.

## Number activation

Recommended path: a fresh dedicated Argentine number for CHIMICHURRI Sales.
- It can be a non-Twilio SIM as long as it can receive SMS or voice OTP during WhatsApp sender registration.
- Register it as a new WhatsApp sender under the CHIMICHURRI Meta Business Portfolio/WABA using Twilio Self Sign-up.
- Argentine WhatsApp sender formatting is `+549...` for mobile numbers.
- Use Twilio Senders API v2 for any programmatic sender registration/status work; v1 is deprecated as of 2026-09-01.

## CRM fields

The Drive Sheet `CHIMI — IG + WHATSAPP OUTBOUND — MASTER`, tab `WA_MASTER`, is the operational source for:
- lead identity
- phone
- phone source
- opt-in status / proof
- customer-service-window state
- exact message or ContentSid
- send receipt / SID
- response
- hot lead
- follow-up
- exclusion

## What remains before production

1. Lucas provides/registers the dedicated sales number (do not paste Twilio secrets in chat).
2. Add `TWILIO_WHATSAPP_SALES_FROM` to Vercel.
3. Create and approve the first CHIMICHURRI marketing template in Twilio Content Template Builder.
4. Deploy this branch or merge after review.
5. Run dry-run against one opted-in test recipient.
6. Send one real test and verify Twilio SID + inbound reply.
7. Only then connect the daily Sales queue.

## Important outbound rule

A public phone number found on a website, Google profile, Instagram bio, directory, etc. is not by itself WhatsApp marketing opt-in. Sales can research and queue prospects, but automated WhatsApp delivery must wait for explicit opt-in. Cold acquisition can start in email/Instagram/manual channels and convert the lead into WhatsApp once consent exists.
