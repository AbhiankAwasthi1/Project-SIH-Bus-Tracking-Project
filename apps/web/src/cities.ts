export type CityId = "greater_noida" | "ahmedabad";

export type City = {
  id: CityId;
  label: string;
  center: [number, number];
  zoom: number;
  sampleBus: string;
};

export const CITIES: Record<CityId, City> = {
  greater_noida: {
    id: "greater_noida",
    label: "Greater Noida",
    center: [77.504, 28.4744],
    zoom: 12.6,
    sampleBus: "GNA-12",
  },
  ahmedabad: {
    id: "ahmedabad",
    label: "Ahmedabad",
    center: [72.5714, 23.033],
    zoom: 12.4,
    sampleBus: "AMTS-102",
  },
};

export type Landmark = {
  name: string;
  lat: number;
  lng: number;
};

/** Named places used only to label hotspot clusters — not a geocoder. */
export const LANDMARKS: Record<CityId, Landmark[]> = {
  greater_noida: [
    { name: "Pari Chowk", lat: 28.4734, lng: 77.50905 },
    { name: "Knowledge Park II", lat: 28.4744, lng: 77.504 },
    { name: "Knowledge Park III", lat: 28.4706, lng: 77.5141 },
    { name: "Jagat Farm", lat: 28.4672, lng: 77.5024 },
    { name: "Alpha Commercial Belt", lat: 28.4618, lng: 77.4974 },
    { name: "Surajpur", lat: 28.4524, lng: 77.5262 },
  ],
  ahmedabad: [
    { name: "Ashram Road", lat: 23.0282, lng: 72.57155 },
    { name: "Nehru Bridge", lat: 23.0286, lng: 72.5721 },
    { name: "Ellis Bridge", lat: 23.0224, lng: 72.5698 },
    { name: "CG Road", lat: 23.0312, lng: 72.5665 },
    { name: "Navrangpura", lat: 23.0368, lng: 72.5762 },
    { name: "Paldi", lat: 23.0196, lng: 72.5794 },
  ],
};

export const DEFAULT_CITY: CityId = "greater_noida";

export function cityOf(lat: number, lng: number): CityId {
  if (lat >= 22.7 && lat <= 23.4 && lng >= 72.3 && lng <= 72.8) {
    return "ahmedabad";
  }
  return "greater_noida";
}
