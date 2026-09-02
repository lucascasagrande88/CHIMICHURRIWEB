# CHIMI WhatsApp Bridge

Vercel-ready bridge for Twilio WhatsApp.

## Vercel

Import this GitHub repository and set **Root Directory** to:

`whatsapp-bridge`

Add these environment variables in Vercel Project Settings:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `CHIMI_WHATSAPP_TO`
- `CHIMI_BRIDGE_TOKEN`

No credential values are stored in this repository.

Deploy, then open:

- `https://YOUR-DOMAIN.vercel.app/api/health`
- `https://YOUR-DOMAIN.vercel.app/test-whatsapp`

For Twilio inbound WhatsApp, set **When a message comes in** to:

`https://YOUR-DOMAIN.vercel.app/api/whatsapp`

Method: POST.

For a free-form outbound test, first send a WhatsApp message from the destination phone to the Twilio WhatsApp sender so the 24-hour customer-service window is open.
