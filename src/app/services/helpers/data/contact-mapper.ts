import { Contact, Company } from "../../../shared/data/interfaces/contact.model";

export function toContactTableRow ( c: any ): Partial<Contact> {
    if ( !c ) return {};

    return {
        id: c.id,
        firstName: c.firstName ?? '',
        middleName: c.middleName ?? '',
        lastName: c.lastName ?? '',
        profession: c.profession ?? '',

        email: c.email ?? '',
        emailAddresses: c.emailAddresses ?? [],
        phoneNumbers: c.phoneNumbers ?? [],
        company: c.company as Company,
        category: c.category ?? '',
        profileTypes: c.profileTypes ?? [],

        status: c.status ?? '',
        sector: c.sector ?? '',
        gender: c.gender ?? '',
        referral: c.referral ?? '',
        stripeCustomerId: c.stripeCustomerId ?? '',

        emailStage: c.emailStage ?? '',
        contactValue: c.contactValue ?? 0,
        subscriber: c.subscriber ?? false,
        affiliate: c.affiliate ?? false,

        isEnriched: c.isEnriched ?? false,
        lastEnriched: c.lastEnriched ?? '',
        isReconfigured: c.isReconfigured ?? false,
        lastReconfigured: c.lastReconfigured ?? '',

        deleted: c.deleted ?? false,
        notEngaged: c.notEngaged ?? false,
        notEngagedReason: c.notEngagedReason ?? '',
        notEngagedAt: c.notEngagedAt ?? null,

        lastContacted: c.lastContacted ?? '',
        lastUpdated: c.lastUpdated ?? c.lastupdated ?? '',
    };
}