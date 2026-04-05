/** Menu for Tegest Restaurant — ids stable for saved prices */
export const CATALOG = [
  {
    id: "hot",
    groupKey: "groupHot",
    items: [
      { id: "coffee small", defaultPrice: 25 },
      { id: "coffee big", defaultPrice: 30 },
      { id: "tea", defaultPrice: 15 },
      { id: "spritz", defaultPrice: 30 },
      { id: "macchiato", defaultPrice: 40 },
      { id: "ginger_tea", defaultPrice: 35 },
    ],
  },
  {
    id: "food",
    groupKey: "groupFood",
    items: [
      { id: "pasta", defaultPrice: 120 },
      { id: "rice", defaultPrice: 120 },
    ],
  },
  {
    id: "beverages",
    groupKey: "groupBeverages",
    items: [
      { id: "syrup", defaultPrice: 40 },
      { id: "water_0_5l", defaultPrice: 15 },
      { id: "water_1l", defaultPrice: 20 },
      { id: "water_2l", defaultPrice: 35 },
      { id: "coca_cola", defaultPrice: 35 },
      { id: "fanta", defaultPrice: 35 },
      { id: "energy_drink", defaultPrice: 45 },
      { id: "hay5", defaultPrice: 40 },
    ],
  },
];

/** Display labels per language (Amharic / Oromiffa only) */
export const ITEM_LABELS = {
  am: {
    coffee: "ቡን",
    tea: "ሻይ",
    spritz: "ስፕሪስስ",
    macchiato: "ማኪያቶ",
    ginger_tea: "ዝንጅብል ሻይ",
    pasta: "ፓስታ",
    rice: "ሩዝ",
    syrup: "ሲሮፕ",
    water_0_5l: "ውሃ 0.5 ሊትር",
    water_1l: "ውሃ 1 ሊትር",
    water_2l: "ውሃ 2 ሊትር",
    coca_cola: "ኮካ ኮላ",
    fanta: "ፋንታ",
    energy_drink: "ኢነርጂ ድሪንክ",
    hay5: "ሃይ5",
  },
  om: {
    coffee: "Buna",
    tea: "Shaayii",
    spritz: "Spritz",
    macchiato: "Macchiato",
    ginger_tea: "Shaayii zinjibilii",
    pasta: "Paastaa",
    rice: "Rootii",
    syrup: "Sirupii",
    water_0_5l: "Bishaanii liitira 0.5",
    water_1l: "Bishaanii liitira 1",
    water_2l: "Bishaanii liitira 2",
    coca_cola: "Kokaakolaa",
    fanta: "Faantaa",
    energy_drink: "Dhugaatii Enerjii",
    hay5: "Hay5",
  },
};

export function itemLabel(lang, itemId) {
  const L = ITEM_LABELS[lang] || ITEM_LABELS.am;
  return L[itemId] || itemId;
}
