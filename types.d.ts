export type Options = {
    clientId:     string
    clientSecret: string
    refreshToken: string
}

export type AllPatronsPledges = {
    id:   string
    type: string
    attributes: {
        campaign_lifetime_support_cents:  number
        currently_entitled_amount_cents:  number
        email:                            string
        full_name:                        string
        is_follower:                      boolean
        last_charge_date:                 string
        last_charge_status:               string
        lifetime_support_cents:           number
        next_charge_date:                 string
        note:                             string
        patron_status:                    PatronStatus
        pledge_cadence:                   string
        pledge_relationship_start:        string
        will_pay_amount_cents:            number
    }
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

export type SocialConnections = {
    discord?:    { user_id: string }
    deviantart?: string
    facebook?:   string
    spotify?:    string
    twitch?:     string
    twitter?:    string
    youtube?:    string
}

export type Patron = {
    campaign_lifetime_support_cents:  number
    currently_entitled_amount_cents:  number
    email:                            string
    full_name:                        string
    is_follower:                      boolean
    last_charge_date:                 string
    last_charge_status:               string
    lifetime_support_cents:           number
    next_charge_date:                 string
    note:                             string
    patron_status:                    PatronStatus
    pledge_cadence:                   string
    pledge_relationship_start:        string
    will_pay_amount_cents:            number
    pledge_id:                        string
    patron_id:                        string
    discord_user_id:                  string | undefined
    currently_entitled_tier_id:       string | undefined
    social_connections:               SocialConnections | undefined
}

export type PatronStatus = 'active_patron' | 'declined_patron' | 'former_patron'
