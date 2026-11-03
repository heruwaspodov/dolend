export function canonicalEventUrl(origin:string,eventId:string,inviteToken?:string) {
  const url=new URL('/event/',origin);
  url.searchParams.set('id',eventId);
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
