import { AllPatronsPledges, AllPatronsSocials, Options, Patron, PatronStatus } from './types'

const PATREON_API   = 'https://www.patreon.com/api/oauth2/v2'
const PATREON_TOKEN = 'https://www.patreon.com/api/oauth2/token'
const MEMBER_FIELDS =
    'fields%5Bmember%5D=campaign_lifetime_support_cents,currently_entitled_amount_cents,' +
    'email,full_name,is_follower,last_charge_date,last_charge_status,lifetime_support_cents,' +
    'next_charge_date,note,patron_status,pledge_cadence,pledge_relationship_start,will_pay_amount_cents'
const MEMBER_INCLUDES = 'include=user,currently_entitled_tiers&fields%5Buser%5D=social_connections'

/** Refresh 5 minutes before actual expiry */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export class Campaign {
    private readonly clientId:     string
    private readonly clientSecret: string

    private refreshToken: string
    private accessToken:  string | null = null
    private expiresAt:    number = 0

    private campaignId: string | null = null

    constructor(options: Options) {
        if (!options.clientId)     throw new Error('clientId is required')
        if (!options.clientSecret) throw new Error('clientSecret is required')
        if (!options.refreshToken) throw new Error('refreshToken is required')

        this.clientId     = options.clientId
        this.clientSecret = options.clientSecret
        this.refreshToken = options.refreshToken
    }

    // ─── Token management ───────────────────────────────────────────────────

    private needsRefresh(): boolean {
        return !this.accessToken || Date.now() >= this.expiresAt - EXPIRY_BUFFER_MS
    }

    private async refresh(): Promise<void> {
        const res = await fetch(PATREON_TOKEN, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token: this.refreshToken,
                client_id:     this.clientId,
                client_secret: this.clientSecret,
            }).toString(),
        })

        if (!res.ok) {
            throw new Error(`Token refresh failed [${res.status}]: ${await res.text()}`)
        }

        const data = await res.json() as {
            access_token:  string
            refresh_token: string
            expires_in:    number
        }

        this.accessToken  = data.access_token
        this.refreshToken = data.refresh_token   // Patreon rotates on each refresh
        this.expiresAt    = Date.now() + data.expires_in * 1000
    }

    private async token(): Promise<string> {
        if (this.needsRefresh()) await this.refresh()
        return this.accessToken!
    }

    // ─── Campaign resolution ────────────────────────────────────────────────

    private async resolveCampaignId(): Promise<string> {
        if (this.campaignId) return this.campaignId

        const res = await fetch(
            `${PATREON_API}/identity?include=campaign&fields%5Bcampaign%5D=id`,
            { headers: { Authorization: `Bearer ${await this.token()}` } }
        )

        if (!res.ok) {
            throw new Error(`Failed to resolve campaign [${res.status}]: ${await res.text()}`)
        }

        const data = await res.json() as {
            included?: { type: string; id: string }[]
        }

        const campaign = data.included?.find(r => r.type === 'campaign')
        if (!campaign) throw new Error('No campaign found for this account')

        this.campaignId = campaign.id
        return this.campaignId
    }

    // ─── Internal data fetching ─────────────────────────────────────────────

    private async get<T>(url: string): Promise<T> {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${await this.token()}` },
        })
        if (!res.ok) throw new Error(`Patreon API error [${res.status}]: ${await res.text()}`)
        return (res.json() as Promise<unknown>) as Promise<T>
    }

    private async scrape(): Promise<{ pledges: AllPatronsPledges[]; socials: AllPatronsSocials[] }> {
        const campaignId = await this.resolveCampaignId()

        let pledges: AllPatronsPledges[] = []
        let socials: AllPatronsSocials[] = []
        let next: string | undefined =
            `${PATREON_API}/campaigns/${campaignId}/members?${MEMBER_INCLUDES}&${MEMBER_FIELDS}`

        type MembersPage = {
            data:     AllPatronsPledges[]
            included: AllPatronsSocials[]
            links?:   { next?: string }
        }

        while (next) {
            const page: MembersPage = await this.get<MembersPage>(next)
            pledges = pledges.concat(page.data)
            socials = socials.concat(page.included ?? [])
            next    = page.links?.next
        }

        return { pledges, socials }
    }

    // ─── Data shaping ───────────────────────────────────────────────────────

    private shape(pledge: AllPatronsPledges, socials: AllPatronsSocials[]): Patron {
        const patronId          = pledge.relationships.user.data.id
        const socialConnections = socials.find(u => u.id === patronId)?.attributes?.social_connections

        return {
            ...pledge.attributes,
            pledge_id:                  pledge.id,
            patron_id:                  patronId,
            discord_user_id:            socialConnections?.discord?.user_id,
            currently_entitled_tier_id: pledge.relationships.currently_entitled_tiers.data[0]?.id,
            social_connections:         socialConnections,
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    async fetchPatrons(statusFilter?: PatronStatus[]): Promise<Patron[]> {
        const { pledges, socials } = await this.scrape()

        const allowed = statusFilter ?? ['active_patron', 'declined_patron', 'former_patron', null] as any

        return pledges
            .filter(p => allowed.includes(p.attributes.patron_status))
            .map(p => this.shape(p, socials))
    }

    async fetchPatron(memberId: string): Promise<Patron> {
        const data = await this.get<{
            data:     AllPatronsPledges
            included: AllPatronsSocials[]
        }>(`${PATREON_API}/members/${memberId}?${MEMBER_INCLUDES}&${MEMBER_FIELDS}`)

        return this.shape(data.data, data.included)
    }
}
