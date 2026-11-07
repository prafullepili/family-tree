# VanshLink — Connecting generations

VanshLink is a responsive family-history application for building, exploring, and sharing family trees. It combines an interactive React canvas with an Express API and MongoDB persistence.

## Features

### People and relationships

- Create and edit people with first name, surname, maiden name, gender, birth/death dates, birthplace, occupation, photo URL, biography, and family notes.
- Link parents, children, partners, siblings, and custom relationships. Each person can have up to two parents.
- Add a father, mother, brother, sister, son, daughter, or partner directly from a node's shortcut menu. Child shortcuts link both known parents and related siblings; sibling shortcuts preserve known parents and sibling connections.
- Browse categorized family links in person details and focus a linked person on the canvas.
- Search people and filter the canvas by family groups.

### Interactive canvas

- Move individual people or groups, pan, zoom, fit/center, arrange families, and enter full screen.
- Rectangle selection, movement locking, touch interaction, and keyboard shortcuts.
- Persist node positions to MongoDB after movement stops.
- Save named favorite views, restore their positions, and remove saved views.
- Dashboard cards, Classic cards, and Family atlas appearances.
- Dark mode by default, with a saved light/dark preference, branch color coding, configurable relationship visibility, and optional black/red deceased ribbons.
- Highlight connections on hover or selection, with relationship information available on links.

### Accounts and collaboration

- Sign in using email/username and password or Google.
- Saved browser credentials follow the login form's light/dark colors.
- Verify new email/password registrations with a 6-digit email code delivered through Gmail SMTP.
- Recover passwords using a 6-digit code delivered through Gmail. Existing reset links remain usable until they expire.
- Create multiple trees and switch between owned and invited trees.
- Manage members, invitation links, activity history, and deleted people.
- Use the header's **Tree actions** menu for New tree, Join tree, Members & invitations, Activity history, and Recycle bin.

### Import and export

- Import CSV and Excel files.
- Export CSV or Excel with selected columns, including readable names and relationships.
- Download an SVG of the entire tree with node information.
- Available export fields include names, maiden name, gender, dates, birthplace, occupation, biography, notes, photo URL, relationships, and coordinates.

## Technology and requirements

- React 18, Vite, and Lucide icons.
- D3 shape utilities for relationship paths; ExcelJS for spreadsheet handling.
- Express, Mongoose, and MongoDB.
- Google Identity Services for Google sign-in; Nodemailer and Gmail SMTP for registration verification and password-recovery codes.
- Node.js **20.19 or later**; the deployment workflow uses Node.js 22.
- npm and an accessible MongoDB instance.

The repository uses npm workspaces:

| Package | Purpose |
| --- | --- |
| Root | Coordinates development, build, test, and startup commands |
| `client` | React website and Vite configuration |
| `server` | Express API, authentication, access control, and database models |

## Local development

Run these commands from the repository root:

```powershell
npm install
Copy-Item server/.env.example server/.env
```

Set `MONGODB_URI` in `server/.env`, then start the application:

```sh
npm run dev
```

Open **http://localhost:5173/family-tree/**.

The API defaults to **http://localhost:4000**. Vite proxies `/api` requests to `http://127.0.0.1:4000`. If you change the local API port, update the proxy target in `client/vite.config.js` too.

Wait for the API listening and MongoDB connected messages before signing in. The API runs in watch mode and restarts when its source changes; a request during a restart can temporarily return `503`.

For local HTTP development, use these server settings:

```env
CLIENT_ORIGIN=http://localhost:5173
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false
PUBLIC_APP_URL=http://localhost:5173/family-tree/
```

Use the same browser hostname throughout a session. Cookies for `localhost` are separate from cookies for `127.0.0.1` or a LAN address.

To run each package separately:

```sh
npm run dev:server
npm run dev:client
```

Authentication requires MongoDB. Google sign-in is optional and requires a Google client ID. New email/password registrations require Gmail delivery configuration by default. Password recovery uses the same Gmail connection.

For both Google integrations, follow [Google and Gmail setup](docs/GOOGLE_SETUP.md). Run `npm run check:google --workspace server` to check the Google client-ID format and verify the Gmail SMTP connection and credentials without sending an email. This does not validate Google Cloud's allowed origins or confirm inbox delivery.

Gmail setup requires Google 2-Step Verification and an App Password for the sending account. Use the App Password rather than the account's normal password. No custom sending domain is required for a personal Gmail sender; Gmail sending limits still apply.

## Environment configuration

Copy `server/.env.example` into `server/.env` for local development. On a hosted API, set these values through the hosting service's environment settings.

### API server

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Private MongoDB connection string. The server currently selects the `familytree` database explicitly. |
| `NODE_ENV` | Set to `production` for a deployed API. |
| `PORT` | Listening port; defaults to `4000`. Render supplies this automatically. |
| `CLIENT_ORIGIN` | Comma-separated allowed frontend origins, without paths or trailing slashes. |
| `COOKIE_SAME_SITE` | `lax` for a same-site deployment; `none` for the GitHub Pages/Render combination. |
| `COOKIE_SECURE` | Set to `true` for HTTPS deployments. Production cookies are always marked Secure. |
| `TRUST_PROXY_HOPS` | Number of trusted reverse-proxy hops. Defaults to `1` in production and `0` otherwise; the example file explicitly sets `0`, so override it on Render. |
| `GOOGLE_CLIENT_ID` | Google Web application client ID; enables the Google sign-in button. |
| `EMAIL_VERIFICATION_REQUIRED` | Defaults to enabled; set to `false` only to explicitly allow new registrations without verification. Existing pending accounts still require verification. |
| `GMAIL_USER` | Gmail address used to send registration and password-recovery codes. |
| `GMAIL_APP_PASSWORD` | Private Gmail App Password, created after enabling Google 2-Step Verification. |
| `EMAIL_OTP_SECRET` | Private random secret of at least 32 characters, used for keyed code hashes; keep stable across API instances. |
| `PUBLIC_APP_URL` | Frontend URL retained for deployment configuration; email codes do not require a reset-link URL. |

Development origins on localhost and supported private-network addresses using port 5173 are also allowed when the API is not running in production.

Never commit real environment files, database credentials, Gmail App Passwords, or OTP secrets. Server environment settings must also be configured on the deployed backend; local `.env` values are not uploaded by GitHub Pages.

### Frontend

`VITE_API_URL` sets the API origin at **build time**, for example:

```env
VITE_API_URL=https://family-tree-t6j3.onrender.com
```

The code uses that Render origin as its production fallback. A local `client/.env.production` can supply `VITE_API_URL`, but that file is ignored by Git and is not present in a fresh checkout. For deployment overrides, supply the variable in the frontend build environment. Rebuild the frontend after changing the API URL.

On `localhost`, `127.0.0.1`, or the IPv6 loopback host, `apiBaseUrl.js` uses same-origin `/api` requests even for a production build configured with a remote API. With Vite on port 5173, those requests reach the local Express server through the proxy. With Express serving the built client on port 4000, they reach that same Express server directly. Other hosts use the configured API URL, or the production fallback when none is configured.

When testing locally, Network requests should show `http://localhost:5173/api/...` (or port 4000 when Express serves the page), rather than the Render origin. A successful login returns an account and CSRF token; subsequent requests still need the session cookie. The JSON response alone does not authenticate later requests.

Only public configuration belongs in `VITE_` variables. Database and email credentials must stay on the API server.

## MongoDB setup

Use a dedicated database user with **readWrite access to the `familytree` database**, rather than an administrative account. Permit the API host's network access in Atlas.

A read-only database credential cannot run this application: login writes sessions and login timestamps, and application operations write people, memberships, and layouts. A website user's Viewer role is enforced by Express and is separate from the API's database permissions.

Collections include:

| Collection | Stores |
| --- | --- |
| `users` | Accounts, password hashes, Google identity, email-verification state, keyed OTP hashes, attempt/send limits, and legacy reset-token metadata |
| `authsessions` | Hashed session tokens, CSRF tokens, expiration, and password versions |
| `people` | Person details, relationships, positions, tree scope, and soft-delete metadata |
| `treelayouts` | Named saved views and person coordinates |
| `familytrees` | Tree names and creators |
| `treememberships` | User membership and role within each tree |
| `treeinvitations` | Email-scoped invitation hashes, roles, and expiration |
| `treeactivities` | Acting member, action, detail, and timestamp |

Startup initializes model indexes and replaces legacy saved-layout indexes where necessary.

## Authentication

Passwords are hashed with scrypt. Sessions use random tokens stored as hashes on the server and delivered through HttpOnly cookies. Authenticated state-changing requests require the session's `X-CSRF-Token`.

New sessions retain the account's current password version. Password recovery increments that version and invalidates older sessions; signing in afterward creates a valid session using the updated version. The client also ignores stale startup session-check responses after a newer sign-in.

### Google sign-in

Create a **Web application** OAuth client in Google Cloud and add the frontend origins under **Authorized JavaScript origins**:

```text
http://localhost
http://localhost:5173
https://prafullepili.github.io
```

Do not include `/family-tree/` in an origin. Add any other frontend origin you actually use.

Leave **Authorized redirect URIs** empty for the current implementation: the Google button uses a popup and JavaScript callback. React sends the returned credential to `/api/auth/google`; that endpoint is not a Google redirect URL.

Set the same client ID as `GOOGLE_CLIENT_ID` on the API and restart/redeploy it. No Google client secret is required by this flow.

The Google script loader shares pending loads across component mounts and offers a retry if loading fails. A personalized Google button may display one account; the account chooser is controlled by Google.

### Password recovery

Select **Forgot password?**, enter the account email, then enter the emailed 6-digit code and choose a new password. Gmail and the OTP secret must be configured. Responses do not reveal whether an account exists.

The generic request-success message is not a delivery receipt: unknown emails, resend limits, or SMTP delivery failures can result in no email. Check the API logs when troubleshooting and use the latest code; never share a code or password in logs or support messages.

Recovery codes expire after 5 minutes, allow at most 5 attempts, and can be used once. Requesting another code invalidates the previous code, requires a 60-second wait, and allows at most 5 deliveries per account per hour. Recovery codes have separate keyed hashes and attempt counters from registration verification codes. IP limits also apply.

Previously issued reset links remain valid until their original expiration. Reset tokens are stored as hashes, expire after 30 minutes, and can be used once. Completing a valid reset changes the password version and invalidates existing sessions. No password-change notification email is sent.

### Email verification codes

New email/password accounts must enter a 6-digit code before a session is issued. Codes expire after 5 minutes and allow at most 5 attempts. Resending invalidates the old code, requires a 60-second wait, and allows at most 5 deliveries per account per hour. Codes are stored as keyed hashes bound to the account, address, and purpose. Server-side IP limits also apply.

Existing accounts remain accessible. Successful Google sign-in uses Google's verified email claim and does not send a separate code. When Gmail is not configured, new email registration and recovery report unavailable errors; Google sign-in remains independent. Registration verification and password recovery use separate codes.

Gmail does not require a custom domain, but its sending limits apply. Render's free web services block outbound SMTP ports, so Gmail delivery needs an SMTP-capable host. See [setup details](docs/GOOGLE_SETUP.md).

## Shared trees and roles

Every account starts with its own tree and can create additional trees or accept invitations to others. A role applies to a particular tree.

| Action | Owner | Editor | Viewer |
| --- | --- | --- | --- |
| Browse people, relationships, activity, and recycle bin | Yes | Yes | Yes |
| Export visible tree data | Yes | Yes | Yes |
| Add/edit people and relationships | Yes | Yes | No |
| Move/arrange nodes, import, and manage saved views | Yes | Yes | No |
| Delete people and restore them | Yes | Yes | No |
| Invite people, revoke invitations, change roles, remove members | Yes | No | No |

The owner cannot be removed or downgraded through member management. Ownership transfer and tree deletion are not provided by the current API.

People and saved views use `treeId`. The API checks membership and permissions before serving or changing tree data. Browser data caches are scoped by account and tree.

### Invitations

Open **Tree actions → Members & invitations**, enter an email, and choose Editor or Viewer. Create and manually share the generated link.

Invitation links expire after **seven days**, are stored as hashes, and can be accepted once by an account with the invited email. Pending invitations can be revoked. **Join tree** also accepts a pasted invitation link or code.

Invitation links are shared manually; automated email delivery is used for registration verification and password recovery.

### Activity and recycle bin

**Activity history** displays the latest 100 recorded actions with the acting member and time.

Deleting people moves them into the **Recycle bin**. Their saved coordinates and relationship references are retained. Restore related people as needed to make their connections visible again. The current version has no automatic purge or permanent-delete endpoint.

Family notes are tree data available to authorized tree members; they do not have separate per-field permissions.

### Existing-data migration

The first legacy archive owner claims unowned records that predate authentication. Existing account-owned people and saved layouts migrate idempotently into that account's first workspace when its tree list opens. Legacy owner fields remain for compatibility.

## Canvas controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Select a person | Click | Tap |
| Move a person or selected group | Drag a person | Drag a person |
| Rectangle selection | Drag empty canvas; Shift adds to selection | Briefly press empty canvas, then drag |
| Pan | Space + drag, or middle-button drag | Drag empty canvas |
| Zoom | Header controls or Ctrl/Command + wheel | Pinch or header controls |
| Open person details | Details icon | Details icon or press and hold |

Use Ctrl/Command + A to select everyone in the current family, Delete to request removal, and Escape to close panels/help. The on-canvas help describes the current controls. Viewer access prevents persistent edits and node movement.

## API reference

All paths below are relative to the API origin.

Authenticated routes use the session cookie. State-changing authenticated routes also require `X-CSRF-Token`. People/layout routes require `X-Tree-Id`; tree routes use their `:treeId` path and verify membership server-side.

### Health and accounts

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | API/database status and authentication configuration flags |
| GET | `/api/auth/config` | Public Google client ID and registration-verification requirement |
| POST | `/api/auth/register` | Create an account; returns 202 with `verificationRequired` and `email` when a code is needed, without issuing a session |
| POST | `/api/auth/login` | Sign in with email/username and password |
| POST | `/api/auth/google` | Verify a Google credential and sign in |
| POST | `/api/auth/verify-email` | Consume a 6-digit code using `email` and `code`, then issue a session |
| POST | `/api/auth/resend-verification` | Request a replacement registration code using `email` |
| GET | `/api/auth/me` | Current account and CSRF token |
| POST | `/api/auth/logout` | End the current session |
| POST | `/api/auth/forgot-password` | Request a recovery code using `email` |
| POST | `/api/auth/reset-password` | Set a password using `email`, `code`, and `password`; legacy `token` and `password` remain supported |

Registration, login, Google sign-in, and password recovery are pre-authentication endpoints. Reset requests are authorized by a valid recovery code or legacy reset token rather than an existing session.

### Trees and collaboration

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/trees` | List accessible trees / create a tree |
| POST | `/api/trees/accept-invitation` | Accept an invitation using `token` |
| GET | `/api/trees/:treeId/members` | List members |
| PATCH / DELETE | `/api/trees/:treeId/members/:memberId` | Change role / remove a non-owner member |
| GET / POST | `/api/trees/:treeId/invitations` | List pending invitations / invite an email with a role |
| DELETE | `/api/trees/:treeId/invitations/:invitationId` | Revoke an invitation |
| GET | `/api/trees/:treeId/activity` | Latest 100 activity entries |
| GET | `/api/trees/:treeId/recycle-bin` | List soft-deleted people |
| POST | `/api/trees/:treeId/recycle-bin/:personId/restore` | Restore a person |

### People and saved views

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/people` | List active people / create a person |
| GET / PATCH / DELETE | `/api/people/:id` | Read / update / soft-delete a person |
| DELETE | `/api/people/batch` | Soft-delete the supplied `ids` |
| POST | `/api/people/import` | Import a `people` array |
| PATCH | `/api/people/layout/positions` | Save `positions` with `id`, `treeX`, and `treeY` |
| PATCH | `/api/people/layout/reset` | Clear active people's stored coordinates |
| GET | `/api/layouts?familyId=...` | List saved views; optional comma-separated `personIds` |
| POST | `/api/layouts` | Save a named view with `familyId` and `positions` |
| DELETE | `/api/layouts/:id` | Remove a saved view |

## Deployment

### GitHub Pages frontend and Render API

The current frontend is served at **https://prafullepili.github.io/family-tree/**. Vite's base path is `/family-tree/`.

The workflow in `.github/workflows/deploy.yml` builds the client with Node.js 22 and deploys `client/dist` to GitHub Pages on pushes to `main` or manual dispatch. The current workflow uses the production API fallback because `client/.env.production` is not tracked and it does not set a `VITE_API_URL` override. To use another API, set `VITE_API_URL` in the workflow's build-step environment. Pushing the frontend does not itself deploy the Express API; deploy the backend changes through its hosting service too.

For a Render service using the repository root:

```text
Build command: npm ci
Start command: npm start
```

Example API environment:

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/familytree
CLIENT_ORIGIN=https://prafullepili.github.io
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
TRUST_PROXY_HOPS=1
PUBLIC_APP_URL=https://prafullepili.github.io/family-tree/
```

Set `GOOGLE_CLIENT_ID` to enable Google sign-in. Render supplies `PORT`; a custom value is not required.

For email verification and recovery, configure these values on the backend too:

```env
EMAIL_VERIFICATION_REQUIRED=true
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your_google_app_password
EMAIL_OTP_SECRET=your_private_random_secret_at_least_32_characters
```

The variable names must match exactly: `PASSWORD` and `SECRET` are not substitutes for `GMAIL_APP_PASSWORD` and `EMAIL_OTP_SECRET`. Keep the OTP secret consistent across backend instances and restart/redeploy after changing environment settings.

**GitHub Pages does not send OTP emails.** It serves the React frontend; the Express backend connects to Gmail. Render's **Free web services block outbound ports 25, 465, and 587**, and the current mailer uses port 465. Valid Gmail credentials do not remove this restriction. An SMTP-capable backend hosting plan is required for the current mailer. See [Render's documented restrictions](https://render.com/docs/free#other-limitations).

| Deployment | Google sign-in | Gmail OTP delivery |
| --- | --- | --- |
| Local Vite + Express | With the correct client ID and allowed origins | With valid credentials and SMTP network access |
| GitHub Pages + Render Free API | With the correct OAuth, CORS, and cookie settings | Blocked by the backend's SMTP port restriction |
| GitHub Pages + SMTP-capable API host | With the correct OAuth, CORS, and cookie settings | With valid backend Gmail settings and SMTP access |

CORS uses the frontend **origin**, not its full page URL. `CLIENT_ORIGIN=https://prafullepili.github.io/family-tree/` is incorrect. Cross-site session cookies are marked Secure and Partitioned by the current server.

Deploy the API before a frontend release that depends on new endpoints or the selected-tree header.

### Single-service hosting

Express can serve `client/dist` alongside the API. For hosting the website at the service root, change Vite's base to `/` and build with `VITE_API_URL=/` so requests stay on the same origin instead of using the production Render fallback.

```sh
npm ci
npm run build
npm start
```

Use the service's frontend origin in `CLIENT_ORIGIN`, its full website URL in `PUBLIC_APP_URL`, and `COOKIE_SAME_SITE=lax` for a same-origin deployment. Configure the build environment before running the build.

## Project structure

```text
client/
  public/                 Static assets and logo
  src/
    AuthApp.jsx           Session bootstrap and authentication entry
    LoginPage.jsx         Sign-in and registration interface
    PasswordRecovery.jsx  Forgot/reset password screens
    EmailVerification.jsx Registration code entry and resend controls
    TreeWorkspace.jsx     Tree selection and collaboration panels
    App.jsx               Interactive family tree workspace
    AppHeader.jsx         Header, search, and account controls
    FamilySidebar.jsx     Family groups and member navigation
    FamilyFilter.jsx      Shared family-group selector
    TreeConnections.jsx   Relationship SVG and link interactions
    TreeNodeLayer.jsx     Node rendering and interaction callbacks
    useTreeHighlights.js  Ancestor and relationship highlighting
    useFamilyLinkGroups.js Categorized person relationships
    useFamilyMemberSearch.js Family filters and member search
    useCanvasFullscreen.js Native fullscreen and mobile fallback
    createDataTransferActions.js CSV, Excel, and SVG import/export actions
    createSavedViewActions.js Save, restore, and remove named tree views
    useTreeCanvasLayout.js Canvas bounds, mobile previews, and layout geometry
    createCanvasNavigation.js Zoom, fit, and person focus actions
    createPersonActions.js Person saves, relationship updates, and deletion
    createPersonNavigation.js Selection, editors, and quick-add shortcuts
    useDetailsPanelResize.js Details panel width, pointer, and keyboard resizing
    FamilyConstellation.jsx Login-page tree illustration
    PasswordField.jsx     Password input and visibility toggle
    apiClient.js          API, session, and selected-tree request helpers
    apiBaseUrl.js         Local versus deployed API origin selection
    googleIdentity.js     Shared Google script loader
    ...                   Canvas, person, settings, layout, and export modules
  vite.config.js          Base path and local API proxy

server/
  index.js                Process startup and database connection
  app.js                  Express configuration and router mounting
  config/                 Environment and database index initialization
  routes/                 Endpoint declarations
  controllers/            Request validation and response handling
  middleware/             Sessions, CSRF, permissions, CORS, limits, audit, errors
  services/               Sessions, reset-token validation, migration, relationship logic
    gmailService.js       Gmail SMTP delivery for account codes
    emailVerificationService.js Registration OTP hashes, expiry, attempts, and resend limits
    passwordRecoveryCodeService.js Recovery OTPs, password changes, and session invalidation
    passwordResetService.js Legacy reset-link validation
  scripts/checkGoogleSetup.js Client-ID format and Gmail SMTP connectivity check
  models/                 MongoDB schemas
  authSecurity.js         Password hashing, cookie, token, and identity utilities
  authRoutes.js           Compatibility exports
  treeAccess.js           Compatibility exports
  *.test.js               Authentication, collaboration, and recovery tests
```

## Commands and tests

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start client and API together |
| `npm run dev:client` | Start Vite |
| `npm run dev:server` | Start the API in watch mode |
| `npm run build` | Build the production frontend |
| `npm start` | Start the API |
| `npm test` | Run all workspace tests |
| `npm run test --workspace client` | Run client tests |
| `npm run test --workspace server` | Run API/security integration tests |
| `npm run check:google --workspace server` | Check Google client-ID format and Gmail SMTP credentials without sending email |

Integration tests start temporary MongoDB instances and mock Gmail delivery. They do not use the live database or send emails. The first run downloads a MongoDB binary and may take longer.

Coverage includes local/deployed API routing, family-data loading, placement, zoom math, Google script loading/retry, password hashing, session password-version preservation, role enforcement, tree isolation, legacy migration, invitations, saved-view isolation, and recycle-bin restore. Account-code tests cover registration gating, expiry, attempt and resend limits, concurrent single-use consumption, SMTP failure cleanup, Google-verified accounts, and password-reset session invalidation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| CORS error on GitHub Pages | Exact `CLIENT_ORIGIN`, API availability, and credentialed-cookie settings |
| Local API is starting or restarting | Wait for the API listening and MongoDB connected messages; retry after the watcher restarts |
| Local page requests Render instead of the local API | Rebuild/reload the current client and use the local development URL; loopback hosts now use same-origin API requests |
| `/api/auth/me` returns 401 before login | Expected when no valid session exists; check the login POST response separately |
| Login returns 200 but trees return 401 | Verify both requests use the same API, the browser accepts and sends the session cookie, and the deployed backend includes the password-version fix |
| Email/username or password is incorrect | Use the account's current password after a reset, or Google sign-in if linked; session routing cannot correct a wrong password |
| Sign-in does not persist across sites | `COOKIE_SAME_SITE=none`, HTTPS, browser cookie policy, and `COOKIE_SECURE=true` |
| Google button stays loading or fails | Retry, browser/network blocking, `GOOGLE_CLIENT_ID`, and authorized JavaScript origins |
| Only one Google account appears on the button | The personalized button is a preview; click it to open Google's selection flow |
| Password recovery is unavailable | Configure Gmail and the OTP secret, and verify SMTP access; linked Google sign-in remains an alternative |
| New registration reports email setup is unavailable | Configure Gmail and the OTP secret; see `docs/GOOGLE_SETUP.md` |
| Verification code never arrives | Check spam, App Password, Gmail limits, API logs, and SMTP access from the hosting plan |
| OTP works locally but fails on GitHub Pages | Verify the deployed API version and its environment settings; Render Free blocks the SMTP port used by Gmail |
| SMTP check passes but no message arrives | The check sends no email; inspect the recipient mailbox, spam, API logs, and account resend limits |
| Reset code/link is expired or already used | Request a new code from Forgot password |
| Read-only MongoDB user cannot log in | The API database user needs write access for sessions and account updates |
| Address already in use on port 4000 | Stop the process already listening there, or change the local API port and Vite proxy |
| Selected-tree request fails | Session, membership, `X-Tree-Id`, and Owner/Editor/Viewer access |
| Node positions appear missing | Correct tree selection, saved view, and successful position-save requests |

## Current limitations

- Photos use URLs; direct file upload and object-storage integration are not implemented.
- Invitations are manually shared links, not automatically emailed.
- Gmail delivery depends on the backend's SMTP network access and Gmail limits; it is incompatible with Render Free's SMTP restrictions.
- Ownership transfer, tree deletion, and permanent recycle-bin deletion are not exposed.
- Activity displays the latest 100 records and has no pagination interface.
- Collaboration uses server-validated requests; there is no live WebSocket synchronization.
- Field-level privacy and automatic merging of independently created trees are not implemented.
