# VanshLink — Connecting generations

VanshLink is a responsive family-history application for building, exploring, and sharing family trees. It combines an interactive React canvas with an Express API and MongoDB persistence.

## Features

### People and relationships

- Create and edit people with first name, surname, maiden name, gender, birth/death dates, birthplace, occupation, photo URL, biography, and family notes.
- Link parents, children, partners, siblings, and custom relationships. Each person can have up to two parents.
- Add relatives directly from a node's shortcut menu.
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
- Recover a forgotten password through an emailed reset link.
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
- Google Identity Services for Google sign-in; Resend for password-recovery emails.
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

The API defaults to **http://localhost:4000**. Vite proxies `/api` requests to that port. If you change the local API port, update the proxy target in `client/vite.config.js` too.

To run each package separately:

```sh
npm run dev:server
npm run dev:client
```

Authentication requires MongoDB. Google sign-in and password-recovery email delivery are optional integrations with additional settings.

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
| `PUBLIC_APP_URL` | Full frontend URL, including its base path, used to build password-reset links. |
| `RESEND_API_KEY` | Server-side Resend API key for account emails. |
| `EMAIL_FROM` | Sender address accepted by your Resend configuration. |

Development origins on localhost and supported private-network addresses using port 5173 are also allowed when the API is not running in production.

Never commit real environment files, database credentials, or email API keys.

### Frontend

`VITE_API_URL` sets the API origin at **build time**, for example:

```env
VITE_API_URL=https://family-tree-t6j3.onrender.com
```

The current production fallback is that Render origin. Development uses the Vite proxy when this variable is unset. Rebuild the frontend after changing the API URL.

Only public configuration belongs in `VITE_` variables. Database and email credentials must stay on the API server.

## MongoDB setup

Use a dedicated database user with **readWrite access to the `familytree` database**, rather than an administrative account. Permit the API host's network access in Atlas.

A read-only database credential cannot run this application: login writes sessions and login timestamps, and application operations write people, memberships, and layouts. A website user's Viewer role is enforced by Express and is separate from the API's database permissions.

Collections include:

| Collection | Stores |
| --- | --- |
| `users` | Accounts, password hashes, Google identity, and hashed reset-token metadata |
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

Select **Forgot password?** on the sign-in page and enter the account email.

- Reset links expire after **30 minutes** and can be used once.
- Only a hash of the reset token is stored.
- Request responses do not disclose whether an email is registered.
- Requests are limited by IP and have a per-account cooldown.
- Resetting a password invalidates existing sessions and requires signing in again.
- Tokens travel in the URL fragment, keeping them out of static-host request paths.
- A password-change notification is also attempted.

Configure Resend delivery on the API:

```env
PUBLIC_APP_URL=https://prafullepili.github.io/family-tree/
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=VanshLink <accounts@your-verified-domain.com>
```

Use a sender authorized by your email provider. For local links, use `PUBLIC_APP_URL=http://localhost:5173/family-tree/`. Production reset links require HTTPS. Without valid delivery settings, the recovery endpoint reports that recovery is unavailable.

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

Invitation email delivery is currently manual; Resend integration sends password-recovery/account emails only.

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
| GET | `/api/auth/config` | Public Google client ID |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in with email/username and password |
| POST | `/api/auth/google` | Verify a Google credential and sign in |
| GET | `/api/auth/me` | Current account and CSRF token |
| POST | `/api/auth/logout` | End the current session |
| POST | `/api/auth/forgot-password` | Request a reset email using `email` |
| POST | `/api/auth/reset-password` | Set a password using `token` and `password` |

Registration, login, Google sign-in, and password recovery are pre-authentication endpoints. Reset requests are authorized by the reset token rather than an existing session.

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

The workflow in `.github/workflows/deploy.yml` builds the client with Node.js 22 and deploys `client/dist` to GitHub Pages on pushes to `main` or manual dispatch. It currently uses the production API fallback in `apiClient.js`; configure a build-time `VITE_API_URL` if deploying against a different API.

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

Add the Google and Resend variables when enabling those integrations. Render supplies `PORT`; a custom value is not required.

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
    TreeWorkspace.jsx     Tree selection and collaboration panels
    App.jsx               Interactive family tree workspace
    apiClient.js          API, session, and selected-tree request helpers
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
  services/               Sessions, recovery email, migration, relationship logic
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

Integration tests start temporary MongoDB instances and mock recovery email delivery. They do not use the live database or send real emails. The first run downloads a MongoDB binary and may take longer.

Coverage includes family-data loading, placement, zoom math, Google script loading/retry, password hashing, sessions, role enforcement, tree isolation, legacy migration, invitations, saved-view isolation, recycle-bin restore, and password-reset expiration/single use/session invalidation.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| CORS error on GitHub Pages | Exact `CLIENT_ORIGIN`, API availability, and credentialed-cookie settings |
| Sign-in does not persist across sites | `COOKIE_SAME_SITE=none`, HTTPS, browser cookie policy, and `COOKIE_SECURE=true` |
| Google button stays loading or fails | Retry, browser/network blocking, `GOOGLE_CLIENT_ID`, and authorized JavaScript origins |
| Only one Google account appears on the button | The personalized button is a preview; click it to open Google's selection flow |
| Password recovery is unavailable | `PUBLIC_APP_URL`, `RESEND_API_KEY`, and `EMAIL_FROM` |
| Reset email never arrives | Spam folder, API logs, sender authorization, and email provider configuration |
| Reset link is expired or already used | Request a new reset link |
| Read-only MongoDB user cannot log in | The API database user needs write access for sessions and account updates |
| Address already in use on port 4000 | Stop the process already listening there, or change the local API port and Vite proxy |
| Selected-tree request fails | Session, membership, `X-Tree-Id`, and Owner/Editor/Viewer access |
| Node positions appear missing | Correct tree selection, saved view, and successful position-save requests |

## Current limitations

- Photos use URLs; direct file upload and object-storage integration are not implemented.
- Invitations are manually shared links, not automatically emailed.
- Ownership transfer, tree deletion, and permanent recycle-bin deletion are not exposed.
- Activity displays the latest 100 records and has no pagination interface.
- Collaboration uses server-validated requests; there is no live WebSocket synchronization.
- Field-level privacy and automatic merging of independently created trees are not implemented.
