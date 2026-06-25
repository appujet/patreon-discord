# patreon-discord

Patreon API v2 wrapper for grabbing patron data without wrestling with JSON:API or OAuth token management.

You hand it your client credentials and a refresh token — it handles access token fetching, expiry, and rotation internally. No manual token refreshing, no `campaignId` hunting.

---

## Install

```sh
npm install patreon-discord
```

---

## Usage

```ts
import { Campaign } from 'patreon-discord'

const campaign = new Campaign({
    clientId:     process.env.PATREON_CLIENT_ID,
    clientSecret: process.env.PATREON_CLIENT_SECRET,
    refreshToken: process.env.PATREON_REFRESH_TOKEN,
})

// fetch all active patrons
const patrons = await campaign.fetchPatrons(['active_patron'])

// fetch a single patron by member ID
const patron = await campaign.fetchPatron('abc123')
```

---

## Getting your credentials

1. Go to the [Patreon Developer Portal](https://www.patreon.com/portal/registration/register-clients) and register a client
2. Note your **Client ID** and **Client Secret**
3. From the same page, grab the **Creator's Refresh Token** under "Token Information"

---

## API

### `new Campaign(options)`

| Option | Type | Description |
|---|---|---|
| `clientId` | `string` | Your Patreon OAuth client ID |
| `clientSecret` | `string` | Your Patreon OAuth client secret |
| `refreshToken` | `string` | Creator refresh token from the developer portal |

The `campaignId` is resolved automatically from the token — no need to find and hardcode it.

---

### `campaign.fetchPatrons(statusFilter?)`

Returns all patrons, optionally filtered by status.

```ts
// all patrons
await campaign.fetchPatrons()

// only active
await campaign.fetchPatrons(['active_patron'])

// active + declined
await campaign.fetchPatrons(['active_patron', 'declined_patron'])
```

**Status values:** `active_patron` · `declined_patron` · `former_patron`

Returns `Patron[]`.

---

### `campaign.fetchPatron(memberId)`

Fetch a single patron by their Patreon member ID.

```ts
const patron = await campaign.fetchPatron('abc123')
```

Returns `Patron`.

---

## Patron object

| Field | Type | Notes |
|---|---|---|
| `patron_id` | `string` | Patreon user ID |
| `pledge_id` | `string` | Member/pledge ID — use this in `fetchPatron()` |
| `discord_user_id` | `string \| undefined` | `undefined` if they haven't linked Discord |
| `currently_entitled_tier_id` | `string \| undefined` | The tier they're currently pledged to |
| `patron_status` | `string` | `active_patron`, `declined_patron`, or `former_patron` |
| `full_name` | `string` | |
| `email` | `string` | |
| `is_follower` | `boolean` | |
| `lifetime_support_cents` | `number` | |
| `currently_entitled_amount_cents` | `number` | |
| `last_charge_date` | `string` | UTC ISO |
| `last_charge_status` | `string` | |
| `next_charge_date` | `string` | UTC ISO |
| `pledge_relationship_start` | `string` | UTC ISO |
| `will_pay_amount_cents` | `number` | |
| `social_connections` | `SocialConnections \| undefined` | Discord, Twitch, YouTube, etc. |

Full field descriptions in [Patreon's Member docs](https://docs.patreon.com/#member).

---

## Token management

Access tokens are fetched and refreshed automatically:

- On the first API call, an access token is obtained using your refresh token
- It's re-fetched 5 minutes before expiry
- Patreon rotates refresh tokens on each use — the new one is kept in memory automatically

Nothing is written to disk.
