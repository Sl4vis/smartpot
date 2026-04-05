/**
 * Plant Emoji Utility
 * Maps plant species/names to appropriate emojis.
 * Priority: plant.emoji (from DB/AI) > species match > name match > fallback
 */

const SPECIES_MAP = {
  'monstera': '🪴',
  'ficus': '🌳',
  'aloe': '🪴',
  'kaktus': '🌵',
  'cactus': '🌵',
  'cacti': '🌵',
  'opuntia': '🌵',
  'echeveria': '🌵',
  'succulent': '🌵',
  'sukulent': '🌵',
  'orchid': '🌸',
  'orchidea': '🌸',
  'phalaenopsis': '🌸',
  'rose': '🌹',
  'ruža': '🌹',
  'tulip': '🌷',
  'tulipán': '🌷',
  'sunflower': '🌻',
  'slnečnica': '🌻',
  'palm': '🌴',
  'palma': '🌴',
  'bamboo': '🎋',
  'bambus': '🎋',
  'herb': '🌿',
  'bazalka': '🌿',
  'basil': '🌿',
  'mint': '🌿',
  'mäta': '🌿',
  'lavender': '💜',
  'levanduľa': '💜',
  'fern': '🌿',
  'papraď': '🌿',
  'ivy': '🍀',
  'brečtan': '🍀',
  'tomato': '🍅',
  'paradajka': '🍅',
  'pepper': '🌶️',
  'paprika': '🌶️',
  'strawberry': '🍓',
  'jahoda': '🍓',
  'lemon': '🍋',
  'citrón': '🍋',
  'cherry': '🍒',
  'čerešňa': '🍒',
  'apple': '🍎',
  'jabloň': '🍎',
  'pine': '🌲',
  'borovica': '🌲',
  'bonsai': '🌳',
  'lotus': '🪷',
  'lilia': '🪷',
  'lily': '🪷',
  'daisy': '🌼',
  'margaréta': '🌼',
  'hibiscus': '🌺',
  'ibištek': '🌺',
  'clover': '🍀',
  'ďatelina': '🍀',
  'maple': '🍁',
  'javor': '🍁',
  'mushroom': '🍄',
  'huba': '🍄',
  'tree': '🌳',
  'strom': '🌳',
  'flower': '🌸',
  'kvet': '🌸',
  'sansevieria': '🌿',
  'pothos': '🪴',
  'philodendron': '🪴',
  'dracaena': '🌿',
  'spathiphyllum': '🪴',
  'calathea': '🪴',
  'begonia': '🌺',
  'geranium': '🌺',
  'petunia': '🌸',
  'chrysanthemum': '🌼',
  'chryzantéma': '🌼',
  'carnation': '🌸',
  'karafiát': '🌸',
  'zamioculcas': '🪴',
  'chlorophytum': '🌿',
  'dieffenbachia': '🪴',
  'azalea': '🌺',
  'jasmine': '🌸',
  'jazmín': '🌸',
};

const FALLBACK_EMOJI = '🌱';

/**
 * Get emoji for a plant. Checks plant.emoji first, then matches species/name.
 */
export function getPlantEmoji(plant) {
  if (!plant) return FALLBACK_EMOJI;

  // 1. Direct emoji from DB (set by AI or user)
  if (plant.emoji) return plant.emoji;

  // 2. Match by species
  if (plant.species) {
    const speciesLower = plant.species.toLowerCase();
    for (const [key, emoji] of Object.entries(SPECIES_MAP)) {
      if (speciesLower.includes(key)) return emoji;
    }
  }

  // 3. Match by name
  if (plant.name) {
    const nameLower = plant.name.toLowerCase();
    for (const [key, emoji] of Object.entries(SPECIES_MAP)) {
      if (nameLower.includes(key)) return emoji;
    }
  }

  return FALLBACK_EMOJI;
}

export default getPlantEmoji;
