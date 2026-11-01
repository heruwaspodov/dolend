export type VenueSnapshotDraft = {
  name: string;
  address: string;
  maps_url: string;
  latitude?: number;
  longitude?: number;
  meeting_instructions?: string;
};

export function venueSnapshotFromForm(form: FormData): VenueSnapshotDraft | undefined {
  const text = (name: string) => String(form.get(name) ?? '').trim();
  const name = text('venue_name');
  const address = text('venue_address');
  const mapsUrl = text('maps_url');
  const latitudeText = text('latitude');
  const longitudeText = text('longitude');
  const meetingInstructions = text('meeting_instructions');
  if (!name && !address && !mapsUrl && !latitudeText && !longitudeText && !meetingInstructions) return;
  if (Boolean(latitudeText) !== Boolean(longitudeText)) throw new Error('Isi latitude dan longitude bersama-sama.');
  let coordinates: { latitude: number; longitude: number } | undefined;
  if (latitudeText && longitudeText) {
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('Koordinat venue tidak valid.');
    }
    coordinates = { latitude, longitude };
  }
  return {
    name,
    address,
    maps_url: mapsUrl,
    ...coordinates,
    ...(meetingInstructions ? { meeting_instructions: meetingInstructions } : {}),
  };
}
