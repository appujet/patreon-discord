import type { AllPatronsPledges, AllPatronsSocials, Options, Patron, PatronStatus } from './types'

const BASE_URL    = 'https://www.patreon.com/api/oauth2/v2'
const TOKEN_URL   = 'https://www.patreon.com/api/oauth2/token'

// Query string fragments reused across requests
const MEMBER_FIELDS   = new URLSearchParams({
    'fields[member]': [
        'campaign_lifetime_support_cents',
        'currently_entitled_amount_cents',
        'email',
        'full_name',
        'is_follower',
        'last_charge_date',
        'last_charge_status',
        'lifetime_support_cents',
        'next_charge_date',
        'note',
        'patron_status',
        'pledge_cadence',
        'pledge_relationship_start',
        'will_pay_amount_cents',
    ].join(','),
    'fields[user]': 'social_connections',
    include: 'user,currently_entitled_tiers',
}).toString()

// Refresh the access token this many ms before it actually expires
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export class Campaign {
    private readonly clientId:     string
    private readonly clientSecret: string

    private refreshToken:  string
    private accessToken:   string | null = null
    private expiresAt:     number        = 0

    // Cached so we don't hit /identity on every request
    private campaignId: string | null = null

    // In-flight refresh promise — prevents concurrent token refreshes
    private refreshing: Promise<void> | null = null

    constructor(options: Options) {
        if (!options.clientId)     throw new Error('clientId is required')
        if (!options.clientSecret) throw new Error('clientSecret is required')
        if (!options.refreshToken) throw new Error('refreshToken is required')

        this.clientId     = options.clientId
        this.clientSecret = options.clientSecret
        this.refreshToken = options.refreshToken
    }

    // ─── Token management ────────────────────────────────────────────────────

    private tokenExpired() {
        return !this.accessToken || Date.now() >= this.expiresAt - EXPIRY_BUFFER_MS
    }

    private async doRefresh(): Promise<void> {
        const res = await fetch(TOKEN_URL, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token: this.refreshToken,
                client_id:     this.clientId,
                client_secret: this.clientSecret,
            }),
        })

        if (!res.ok) {
            const body = await res.text()
            throw new Error(`Token refresh failed (${res.status}): ${body}`)
        }

        const data = await res.json() as {
            access_token:  string
            refresh_token: string
            expires_in:    number
        }

        this.accessToken  = data.access_token
        this.refreshToken = data.refresh_token  // Patreon rotates the refresh token on every use
        this.expiresAt    = Date.now() + data.expires_in * 1000
    }

    private async getToken(): Promise<string> {
        if (!this.tokenExpired()) return this.accessToken!

        // If a refresh is already in-flight, wait for it instead of firing another one
        if (!this.refreshing) {
            this.refreshing = this.doRefresh().finally(() => {
                this.refreshing = null
            })
        }

        await this.refreshing
        return this.accessToken!
    }

    // ─── HTTP ────────────────────────────────────────────────────────────────

    private async get<T>(url: string): Promise<T> {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${await this.getToken()}` },
        })

        if (!res.ok) {
            const body = await res.text()
            throw new Error(`Patreon API error (${res.status}): ${body}`)
        }

        return res.json() as Promise<T>
    }

    // ─── Campaign resolution ─────────────────────────────────────────────────

    private async getCampaignId(): Promise<string> {
        if (this.campaignId) return this.campaignId

        const data = await this.get<{
            included?: { type: string; id: string }[]
        }>(`${BASE_URL}/identity?include=campaign&fields[campaign]=id`)

        const campaign = data.included?.find(r => r.type === 'campaign')
        if (!campaign) throw new Error('No campaign found on this account')

        this.campaignId = campaign.id
        return campaign.id
    }

    // ─── Data shaping ────────────────────────────────────────────────────────

    private buildPatron(pledge: AllPatronsPledges, socials: AllPatronsSocials[]): Patron {
        const patronId   = pledge.relationships.user.data.id
        const userSocial = socials.find(u => u.id === patronId)
        const connections = userSocial?.attributes?.social_connections

        return {
            ...pledge.attributes,
            pledge_id:                  pledge.id,
            patron_id:                  patronId,
            discord_user_id:            connections?.discord?.user_id,
            currently_entitled_tier_id: pledge.relationships.currently_entitled_tiers.data[0]?.id,
            social_connections:         connections,
        }
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Fetch all campaign members, optionally filtered by patron status.
     *
     * @param statusFilter - Leave empty to get everyone. Pass one or more of
     *   `'active_patron'`, `'declined_patron'`, `'former_patron'` to narrow results.
     */
    async fetchPatrons(statusFilter?: PatronStatus[]): Promise<Patron[]> {
        const campaignId = await this.getCampaignId()

        const pledges: AllPatronsPledges[] = []
        const socials: AllPatronsSocials[] = []

        type MembersPage = {
            data:      AllPatronsPledges[]
            included?: AllPatronsSocials[]
            links?:    { next?: string }
        }

        let url: string | undefined = `${BASE_URL}/campaigns/${campaignId}/members?${MEMBER_FIELDS}`

        while (url) {
            const page: MembersPage = await this.get<MembersPage>(url)

            pledges.push(...page.data)
            socials.push(...(page.included ?? []))
            url = page.links?.next
        }

        const patrons = pledges.map(p => this.buildPatron(p, socials))

        if (!statusFilter?.length) return patrons
        return patrons.filter(p => statusFilter.includes(p.patron_status as PatronStatus))
    }

    /**
     * Fetch a single patron by their Patreon member ID.
     *
     * @param memberId - The `pledge_id` from a `Patron` object.
     */
    async fetchPatron(memberId: string): Promise<Patron> {
        const data = await this.get<{
            data:      AllPatronsPledges
            included?: AllPatronsSocials[]
        }>(`${BASE_URL}/members/${memberId}?${MEMBER_FIELDS}`)

        return this.buildPatron(data.data, data.included ?? [])
    }
}
