import type { SubscriptionInfo } from '../../types'

/** "0712 345 678" → "255712345678" (Tanzania default), for wa.me links. */
export function intlDigits(phone: string): string {
  let d = phone.replace(/\D+/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '255' + d.slice(1)
  else if (d.length === 9) d = '255' + d
  return d
}

export function contactLinks(contact: SubscriptionInfo['contact'] | undefined, businessName?: string) {
  const text = encodeURIComponent(`Hello, I would like to subscribe to Dukani${businessName ? ` for ${businessName}` : ''}.`)
  return {
    call: contact?.phone ? `tel:${contact.phone.replace(/[^\d+]/g, '')}` : null,
    whatsapp: contact?.whatsapp ? `https://wa.me/${intlDigits(contact.whatsapp)}?text=${text}` : null,
    email: contact?.email ? `mailto:${contact.email}?subject=${encodeURIComponent('Dukani subscription')}&body=${text}` : null,
  }
}
