export const eventShareSectionId = 'share-event-title';

function isEventDateInPast(startsAt: string, timezone: string, now = new Date()) {
  const dateInTimezone = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  try {
    return dateInTimezone(new Date(startsAt)) < dateInTimezone(now);
  } catch {
    return false;
  }
}

export function canShareEvent(status: string, startsAt?: string, timezone?: string) {
  const statusAllowsSharing = status === 'confirmed' || status === 'published' || status === 'completed';
  if (!statusAllowsSharing) return false;
  if (!startsAt || !timezone) return true;
  return !isEventDateInPast(startsAt, timezone);
}

export function canonicalEventUrl(origin:string,publicCode:string|undefined,eventId:string,inviteToken?:string) {
  const url=publicCode?new URL(`/d/${encodeURIComponent(publicCode)}`,origin):new URL('/event/',origin);
  if(!publicCode)url.searchParams.set('id',eventId);
  if(inviteToken)url.hash=new URLSearchParams({invite:inviteToken}).toString();
  return url.toString();
}

export function eventShareText(input:{title:string;startsAt:string;timezone:string;venueName:string;url:string}) {
  const schedule=new Intl.DateTimeFormat('id-ID',{dateStyle:'full',timeStyle:'short',timeZone:input.timezone}).format(new Date(input.startsAt));
  return `Yuk ikut ${input.title}\n${schedule}\n${input.venueName}\n\nBuka detail dan booking: ${input.url}`;
}

export function whatsAppShareUrl(message:string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
