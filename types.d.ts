export type Options = {
    /** Your Patreon OAuth client ID */
    clientId: string
    /** Your Patreon OAuth client secret */
    clientSecret: string
    /** Creator refresh token from the Patreon developer portal */
    refreshToken: string
}

export type PatronStatus = 'active_patron' | 'declined_patron' | 'former_patron'

export type SocialConnections = {
    discord?:    { user_id: string }
    deviantart?: string | null
    facebook?:   string | null
    spotify?:    string | null
    twitch?:     string | null
    twitter?:    string | null
    youtube?:    string | null
}

export type Patron = {
    /** Patreon user ID */
    patron_id: string
    /** Member/pledge ID — pass this to `fetchPatron()` */
    pledge_id: string
    /** `undefined` if the patron hasn't linked their Discord account */
    discord_user_id: string | undefined
    /** The tier they're currently pledged to. `undefined` if none */
    currently_entitled_tier_id: string | undefined
    patron_status: PatronStatus
    full_name: string
    email: string
    is_follower: boolean
    lifetime_support_cents: number
    campaign_lifetime_support_cents: number
    currently_entitled_amount_cents: number
    will_pay_amount_cents: number
    last_charge_date: string
    last_charge_status: string
    next_charge_date: string
    pledge_relationship_start: string
    pledge_cadence: string
    note: string
    social_connections: SocialConnections | undefined
}

// ─── Internal API shapes (not exported) ─────────────────────────────────────

export type AllPatronsPledges = {
    id:   string
    type: string
    attributes: Omit<Patron,
        | 'patron_id'
        | 'pledge_id'
        | 'discord_user_id'
        | 'currently_entitled_tier_id'
        | 'social_connections'
    >
    relationships: {
        currently_entitled_tiers: {
            data: { id: string; type: string }[]
        }
        user: {
            data: { id: string; type: string }
        }
    }
}

export type AllPatronsSocials = {
    id:   string
    type: string
    attributes: {
        social_connections?: SocialConnections
    }
}
