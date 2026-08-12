import type { Language } from './index'

type CatalogCopy = { name: string; description?: string; unit?: string }

const englishCatalog: Record<string, CatalogCopy> = {
  F1: { name: 'Floor 1', description: 'Convenient rooms for short stays and families.' },
  F2: { name: 'Floor 2', description: 'Quiet standard accommodation with easy access.' },
  F3: { name: 'Floor 3', description: 'Upper floor reserved for Superior and Deluxe rooms.' },
  STD: { name: 'Standard', description: 'A neat, practical room for business travellers or couples.' },
  SUP: { name: 'Superior', description: 'More space and a work desk for a flexible stay.' },
  DLX: { name: 'Deluxe', description: 'An upgraded room with a lounge area, privacy and a preferred view.' },
  FAM: { name: 'Family', description: 'A family room optimised for small groups and longer stays.' },
  WIFI: { name: 'High-speed Wi-Fi', description: 'In-room Internet connection.' },
  AC: { name: 'Air conditioning', description: 'Individually controlled air conditioning.' },
  TV: { name: 'Smart TV', description: 'Smart television for in-room entertainment.' },
  MINIBAR: { name: 'Minibar', description: 'In-room minibar refrigerator.' },
  KETTLE: { name: 'Electric kettle', description: 'Electric kettle with basic tea supplies.' },
  HAIR_DRYER: { name: 'Hair dryer', description: 'Hair dryer in the bathroom.' },
  DESK: { name: 'Work desk', description: 'Dedicated desk and chair.' },
  SAFE: { name: 'In-room safe', description: 'Personal safe for valuables.' },
  BALCONY: { name: 'Balcony', description: 'Bright private balcony.' },
  BATHTUB: { name: 'Bathtub', description: 'Private in-room bathtub.' },
  SOFA: { name: 'Sofa area', description: 'Comfortable in-room seating area.' },
  BREAKFAST: { name: 'Breakfast', description: 'Standard breakfast for one guest.', unit: 'portion' },
  LAUNDRY: { name: 'Laundry', description: 'Wash and dry service by kilogram.', unit: 'kg' },
  AIRPORT_TRANSFER: { name: 'Airport transfer', description: 'One-way airport pickup or drop-off.', unit: 'trip' },
  EXTRA_BED: { name: 'Extra bed', description: 'Extra bed with linen for one night.', unit: 'night' },
  MOTORBIKE: { name: 'Motorbike rental', description: 'Motorbike rental for 24 hours.', unit: 'day' },
  MINERAL_WATER: { name: 'Minibar water', description: 'Additional bottled water beyond the complimentary allowance.', unit: 'bottle' },
  COFFEE: { name: 'Coffee', description: 'Coffee served in-room or in the guest lounge.', unit: 'cup' },
}

export function catalogName(code: string | undefined, fallback: string, language: Language) {
  return language === 'en' && code ? englishCatalog[code]?.name ?? fallback : fallback
}

export function catalogDescription(code: string | undefined, fallback: string | undefined, language: Language) {
  return language === 'en' && code ? englishCatalog[code]?.description ?? fallback : fallback
}

export function catalogUnit(code: string | undefined, fallback: string, language: Language) {
  return language === 'en' && code ? englishCatalog[code]?.unit ?? fallback : fallback
}

export function ratePlanName(code: string | undefined, fallback: string, language: Language) {
  if (language !== 'en' || !code) return fallback
  const roomCode = code.split('-')[0]
  const room = englishCatalog[roomCode]?.name
  const suffix = code.endsWith('-HOUR') ? 'Hourly' : code.endsWith('-DAY') ? 'Daily' : code.endsWith('-NIGHT') ? 'Nightly' : undefined
  return room && suffix ? `${room} - ${suffix}` : fallback
}
