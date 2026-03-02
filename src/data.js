const baseResidential = [
  { id: 'wohn-villa', name: 'Villa', size: [3, 3], roadRange: 20, radius: 12, category: 'residential', icon: '🏠' },
  { id: 'wohn-domus', name: 'Domus', size: [3, 4], roadRange: 15, radius: 12, category: 'residential', icon: '🏡' },
  { id: 'wohn-insula', name: 'Insula', size: [4, 6], roadRange: 25, radius: 12, category: 'residential', icon: '🏢' },
  { id: 'wohn-palat', name: 'Palat', size: [4, 4], roadRange: 22, radius: 12, category: 'residential', icon: '🏛️' },
].map((b) => ({
  ...b,
  effects: { gold: 2, population: 1, religion: 0, prestige: 0, satisfaction: 0, fire: 0 },
}));

const roads = [
  { id: 'road-dirt', name: 'Erdstraße', category: 'road', roadType: 1, color: '#9b6a3f', icon: '🟫' },
  { id: 'road-stone', name: 'Steinstraße', category: 'road', roadType: 2, color: '#b7bec9', icon: '⬜' },
  { id: 'road-marble', name: 'Marmorstraße', category: 'road', roadType: 3, color: '#f5f5f5', icon: '▫️' },
];

const makePublic = (idx) => ({
  id: `public-${idx}`,
  name: ['Bad', 'Forum', 'Tempel', 'Theater', 'Markt', 'Wache', 'Schule', 'Hafenamt', 'Archiv', 'Brunnen', 'Gericht', 'Hospital'][idx - 1],
  size: [2 + (idx % 2), 2 + (idx % 3 === 0 ? 1 : 0)],
  roadRange: 10 + idx,
  radius: idx % 3 === 0 ? 8 : 0,
  category: 'public',
  icon: '🏛️',
  effects: { gold: 0, population: 0, religion: idx % 2, prestige: 1, satisfaction: 1, fire: 1 },
});

const makeProduction = (idx) => ({
  id: `prod-${idx}`,
  name: `Produktionsgebäude ${idx}`,
  size: [2 + (idx % 3), 2 + ((idx + 1) % 2)],
  roadRange: 12 + (idx % 15),
  radius: 6 + (idx % 8),
  category: 'production',
  icon: '⚙️',
  effects: { gold: (idx % 4) - 1, population: 0, religion: 0, prestige: idx % 2, satisfaction: idx % 3 ? 0 : -1, fire: idx % 2 ? 1 : -1 },
});

export const buildingGroups = {
  roads,
  residential: baseResidential,
  public: Array.from({ length: 12 }, (_, i) => makePublic(i + 1)),
  production: Array.from({ length: 40 }, (_, i) => makeProduction(i + 1)),
};

export const allPlaceables = [
  ...buildingGroups.roads,
  ...buildingGroups.residential,
  ...buildingGroups.public,
  ...buildingGroups.production,
];

export const byId = new Map(allPlaceables.map((item) => [item.id, item]));

export const statKeys = [
  ['gold', 'Einkommen'],
  ['population', 'Bevölkerung'],
  ['religion', 'Religion'],
  ['prestige', 'Ansehen'],
  ['satisfaction', 'Zufriedenheit'],
  ['fire', 'Feuer'],
];
