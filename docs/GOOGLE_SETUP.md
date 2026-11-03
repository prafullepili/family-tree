# Google sign-in and Gmail verification codes

These are separate integrations. Google sign-in uses a public Web client ID. Gmail delivery uses a private App Password on the API server. An OAuth client ID cannot send emails.

## Gmail delivery

No custom domain is needed to send from a personal Gmail address. Gmail imposes sending and abuse limits. Google receives recipient addresses and verification-email content when delivering these messages.

1. Open your [Google Account security settings](https://myaccount.google.com/security) and enable 2-Step Verification.
2. Open [App Passwords](https://myaccount.google.com/apppasswords) and create one named **VanshLink**. Some managed accounts, Advanced Protection accounts, and security configurations do not offer App Passwords.
3. Add the generated password to `server/.env` yourself. Do not use your normal Google password, put it in frontend variables, or commit it.

```env
EMAIL_VERIFICATION_REQUIRED=true
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your_google_app_password
EMAIL_OTP_SECRET=an_independent_random_secret_at_least_32_characters_long
```

The local setup may already contain a generated OTP secret. Keep it private and stable across API instances. If needed, generate one with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Restart the API after editing its environment, then check the connection without sending an email:

```sh
npm run check:google --workspace server
```

With email verification required (the default), new email/password registrations cannot start unless Gmail and the OTP secret are configured. Existing accounts remain accessible. Explicitly setting `EMAIL_VERIFICATION_REQUIRED=false` disables verification for future registrations; it does not unlock accounts already waiting for verification.

New email/password accounts receive a 6-digit code, valid for 5 minutes. Codes have at most 5 attempts, are single use, and are stored as keyed hashes bound to the account and email-verification purpose. Resending replaces the prior code, with a 60-second cooldown and at most 5 deliveries per account per hour. API endpoints also enforce IP limits. Google sign-in verifies an address using Google's verified-email claim, without sending another code.

The Gmail connection also delivers password-recovery codes through **Forgot password?**. Users enter their email, the 6-digit reset code, and a new password. Recovery uses separate code hashes and counters from registration verification, with the same 5-minute expiry, 5-attempt limit, 60-second cooldown, and 5-deliveries-per-hour account limit. A successful reset changes the password version and signs out existing sessions. Neither emailed code flow is a second authentication factor.

## Google sign-in

The application already uses Google Identity Services and server-side credential verification. Use the existing Web application OAuth client if one is already configured.

1. Open [Google Auth Platform clients](https://console.cloud.google.com/auth/clients).
2. Select the Web application client used for VanshLink.
3. Under **Authorized JavaScript origins**, add:

```text
http://localhost
http://localhost:5173
https://prafullepili.github.io
```

Add `http://localhost:4000` only if you also open the built frontend through Express on that port. Origins contain no `/family-tree/` path. Local testing should use localhost; a private LAN HTTP address may not qualify for Google's web sign-in requirements.

4. Leave **Authorized redirect URIs** empty for this popup/callback implementation.
5. In Branding, use **VanshLink** as the application name and your support email. If the project is in Testing, configure its test users as required by Google.
6. Save the Web client ID in `server/.env`:

```env
GOOGLE_CLIENT_ID=your_web_client_id.apps.googleusercontent.com
```

No Google client secret, Gmail scope, or Gmail App Password is required for sign-in itself. Restart/redeploy the API after changing the client ID. Existing client IDs do not need to be replaced.

## Hosting

Local development uses the Vite `/api` proxy and same-origin session cookies. Production needs a host that allows outbound TLS SMTP on port 465. Render's free web services block ports 465 and 587, so Gmail SMTP will not work there. Google sign-in still works independently of SMTP.

Do not purchase hosting or enable another delivery provider just for this setup without reviewing that choice first. This code does not provision external services or change Google Cloud settings automatically.

References: [Google App Passwords](https://support.google.com/accounts/answer/185833), [Google sign-in setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [Render free-service restrictions](https://render.com/docs/free).
