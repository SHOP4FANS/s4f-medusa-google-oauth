# Medusa Google OAuth Plugin

A Medusa v2 plugin that enables Google OAuth authentication for admin users. It handles the full OAuth callback flow — creating new users on first login and relinking existing users on subsequent logins — via a custom API route, middleware, and workflow.

---

## Features

- Google OAuth login for admin users via a login widget
- Automatically creates a new Medusa user on first login
- Relinks auth identity for returning users without throwing duplicate errors
- Custom middleware validates that only Google-authenticated requests reach the route
- Bearer token authentication for the custom API route

---

## Prerequisites

### 1. Medusa v2 project

This plugin requires an existing Medusa v2 project.

### 2. Google OAuth credentials

Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/) and note your `client_id`, `client_secret`, and the callback URL you register.

### 3. Medusa Google auth provider

The plugin depends on Medusa's built-in Google auth provider. Add the following to your `medusa-config.ts`:

```typescript
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

// medusa-config.ts
module.exports = defineConfig({
  // ...
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          // Keep your existing providers, e.g.:
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          // Add Google provider:
          {
            resolve: "@medusajs/medusa/auth-google",
            id: "google",
            options: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              callbackUrl: process.env.GOOGLE_CALLBACK_URL,
            },
          },
        ],
      },
    },
  ],
})
```

---

## Environment Variables

Add the following to your `.env` file:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:9000/app/login
```

The `GOOGLE_CALLBACK_URL` must exactly match the authorized redirect URI registered in Google Cloud Console.

---

## Project Structure

```
src/
├── api/
│   ├── custom-auth/
│   │   └── admin/
│   │       └── users/
│   │           └── route.ts          # POST endpoint to create/link user
│   ├── middlewares.ts                 # Auth + provider validation middleware
│   ├── validate-custom-auth-provider.ts  # Google provider guard middleware
│   └── admin/
│       └── widgets/
│           └── login.tsx              # Google login button widget
├── workflows/
│   └── create-user.ts                # Workflow: create or reuse existing user
```

---

## API Route

**`POST /custom-auth/admin/users`**

Creates a new admin user or relinks an existing one to the Google auth identity. Protected by bearer token authentication and Google provider validation.

Request body:

```json
{
  "email": "user@example.com"
}
```

Response:

```json
{
  "user": {
    "id": "user_...",
    "email": "user@example.com"
  }
}
```

---

## Middleware

Registered in `src/api/middlewares.ts`, two middlewares protect the route:

1. `authenticate("user", "bearer", { allowUnregistered: true })` — verifies the Bearer token from the OAuth callback. `allowUnregistered: true` is required so that tokens for users who don't yet exist in the system are still accepted (new users haven't been created yet at this point)
2. `validateCustomAuthProvider` — confirms the auth identity was created via the Google provider

```typescript
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import validateCustomAuthProvider from "./validate-custom-auth-provider"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/custom-auth/admin/users",
      methods: ["POST"],
      middlewares: [
        authenticate("user", "bearer", {
          allowUnregistered: true,
        }),
        validateCustomAuthProvider,
      ],
    },
  ],
})
```

---

## Workflow

The `create-user` workflow in `src/workflows/create-user.ts`:

1. Queries for an existing user by email
2. Creates a new user only if none exists
3. Calls `setAuthAppMetadataStep` to link the auth identity to the user in both cases

This ensures idempotent logins — repeated Google logins never throw a "user already exists" error.

---

## Login Widget

The widget renders a **Login with Google** button in the Medusa admin login form (`login.after` zone). On click it:

1. Initiates the OAuth flow via `sdk.auth.login("user", "google", {})`
2. Redirects to Google for authentication
3. On callback, exchanges the code for a token via `sdk.auth.callback`
4. Decodes the token to check if the user already exists (`actor_id`)
5. If new, calls `POST /custom-auth/admin/users` with the Bearer token in the `Authorization` header to create the user
6. Refreshes the token via `sdk.auth.refresh({ Authorization: \`Bearer ${token}\` })` to get a fully linked session token
7. Navigates to `/orders`

---

## How It Works (Flow)

```
User clicks "Login with Google"
        ↓
Redirected to Google OAuth consent screen
        ↓
Google redirects back with ?code=...
        ↓
Widget calls sdk.auth.callback → receives JWT
        ↓
Decode JWT → check actor_id
        ↓
  actor_id empty?
  ├── Yes → POST /custom-auth/users (with Bearer token)
  │         → workflow creates user & links auth identity
  │         → sdk.auth.refresh()
  └── No  → user already exists, auth identity already linked
        ↓
navigate("/orders")
```

---

## Notes

- The custom route lives at `/custom-auth/admin/users`. Even though it contains `/admin/` in the path, Medusa does **not** intercept it with its own admin middleware because the `authenticate` middleware is configured with `allowUnregistered: true`, which permits tokens for users not yet in the system.
- The Bearer token must be passed explicitly in the `Authorization` header when calling the custom route, as the SDK session is not fully established immediately after `sdk.auth.callback`.
- `sdk.auth.refresh` must also receive the Bearer token explicitly (`{ Authorization: \`Bearer ${token}\` }`) so it can exchange the unregistered token for a fully linked session token after the user is created.