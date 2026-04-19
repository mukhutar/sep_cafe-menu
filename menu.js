// ─────────────────────────────────────────────
//  menu.js  –  Sep Cafe menu data
//  Sweets are the only category with qty tracking
//  All drink categories default to unlimited
// ─────────────────────────────────────────────

const MENU = {
  "Hot Drinks": {
    trackQty: false,
    items: [
      { n: "Espresso",             p: 0.800 },
      { n: "Americano",            p: 0.800 },
      { n: "Hot Chocolate",        p: 1.300 },
      { n: "Espresso Machiatto",   p: 1.000 },
      { n: "Cortado",              p: 1.000 },
      { n: "Piccolo",              p: 1.000 },
      { n: "Zafran Cortado",       p: 1.100 },
      { n: "Flat White",           p: 1.100 },
      { n: "Latte",                p: 1.000 },
      { n: "Cappuccino",           p: 1.200 },
      { n: "Spanish Latte",        p: 1.200 },
      { n: "Caramel Latte",        p: 1.300 },
      { n: "Salted Caramel Latte", p: 1.300 },
      { n: "Pistachio Latte",      p: 1.300 },
      { n: "Zafron Latte",         p: 1.300 },
      { n: "Rose Latte",           p: 1.300 },
      { n: "Vanilla Latte",        p: 1.300 },
      { n: "Hazelnut Latte",       p: 1.300 },
      { n: "Nutella Latte",        p: 1.300 },
      { n: "White Mocha",          p: 1.300 },
      { n: "Classic Mocha",        p: 1.300 },
    ]
  },
  "Cold Drinks": {
    trackQty: false,
    items: [
      { n: "Ice Latte",                  p: 1.100 },
      { n: "Ice Americano",              p: 0.800 },
      { n: "Vanilla Latte (iced)",       p: 1.300 },
      { n: "Hazelnut Latte (iced)",      p: 1.300 },
      { n: "Spanish Latte (iced)",       p: 1.200 },
      { n: "Pistachio Latte (iced)",     p: 1.300 },
      { n: "Zafron Latte (iced)",        p: 1.300 },
      { n: "Rose Latte (iced)",          p: 1.300 },
      { n: "Nutella Latte (iced)",       p: 1.300 },
      { n: "Classic Mocha (iced)",       p: 1.300 },
      { n: "White Mocha (iced)",         p: 1.300 },
      { n: "Caramel Salted Latte (iced)",p: 1.300 },
      { n: "Cream Espresso",             p: 1.000 },
    ]
  },
  "Filtered Hot": {
    trackQty: false,
    items: [
      { n: "V60 Classic (hot)",       p: 1.400 },
      { n: "V60 Mango (hot)",         p: 1.700 },
      { n: "V60 Pina Colada (hot)",   p: 1.700 },
      { n: "V60 Passion Fruit (hot)", p: 1.700 },
      { n: "V60 Premium (hot)",       p: 1.700 },
      { n: "Chemex (hot)",            p: 1.500 },
    ]
  },
  "Filtered Cold": {
    trackQty: false,
    items: [
      { n: "V60 Classic (cold)",       p: 1.400 },
      { n: "V60 Mango (cold)",         p: 1.700 },
      { n: "V60 Pina Colada (cold)",   p: 1.700 },
      { n: "V60 Passion Fruit (cold)", p: 1.700 },
      { n: "V60 Premium (cold)",       p: 1.700 },
      { n: "Chemex (cold)",            p: 1.500 },
      { n: "Cold Brew",                p: 1.400 },
      { n: "Mixed Cold Brew",          p: 1.500 },
      { n: "Cold Brew Signature",      p: 1.700 },
    ]
  },
  "Matcha": {
    trackQty: false,
    items: [
      { n: "Matcha Classic",    p: 1.500 },
      { n: "Matcha Latte",      p: 1.600 },
      { n: "Matcha Rose Latte", p: 1.600 },
    ]
  },
  "Ice Tea": {
    trackQty: false,
    items: [
      { n: "Ice Tea Passion",     p: 1.200 },
      { n: "Ice Tea Peach",       p: 1.200 },
      { n: "Ice Tea Pomegranate", p: 1.200 },
      { n: "Ice Tea Blueberry",   p: 1.200 },
      { n: "Ice Tea Strawberry",  p: 1.200 },
      { n: "Ice Tea Watermelon",  p: 1.200 },
      { n: "Ice Tea Mango",       p: 1.200 },
      { n: "Ice Tea Lemon",       p: 1.200 },
      { n: "Karkadiya",           p: 1.200 },
    ]
  },
  "Mojito": {
    trackQty: false,
    items: [
      { n: "Mojito Passion",     p: 1.100 },
      { n: "Mojito Peach",       p: 1.100 },
      { n: "Mojito Pomegranate", p: 1.100 },
      { n: "Mojito Blueberry",   p: 1.100 },
      { n: "Mojito Strawberry",  p: 1.100 },
      { n: "Mojito Watermelon",  p: 1.100 },
      { n: "Mojito Mango",       p: 1.100 },
      { n: "Mojito Lime",        p: 1.100 },
    ]
  },
  "Sweets": {
    trackQty: true,          // ← only this category tracks stock numbers
    items: [
      { n: "Tiramisu Coffee",        p: 1.500 },
      { n: "Tiramisu Mango",         p: 1.500 },
      { n: "Mix Barry",              p: 1.400 },
      { n: "Chocolate Cake",         p: 1.400 },
      { n: "Date Cake",              p: 1.500 },
      { n: "Mango Chia",             p: 1.500 },
      { n: "Riyadh Cake",            p: 1.500 },
      { n: "Honey Cake",             p: 1.500 },
      { n: "Trifle Mango",           p: 1.400 },
      { n: "Lava Cookies",           p: 1.400 },
      { n: "Chocolate Pudding",      p: 1.100 },
      { n: "September Signature",    p: 1.600 },
      { n: "Snickers Pistachio Cake",p: 1.400 },
      { n: "Matilda Cake",           p: 1.600 },
      { n: "Raspberry Cake",         p: 1.500 },
      { n: "San Sebastián Cake",     p: 1.800 },
    ]
  }
};

// Flat list helper
function allItems() {
  const arr = [];
  Object.entries(MENU).forEach(([cat, { trackQty, items }]) =>
    items.forEach(i => arr.push({ ...i, cat, trackQty }))
  );
  return arr;
}

// Does this item need quantity tracking?
function itemTracksQty(name) {
  return allItems().find(i => i.n === name)?.trackQty ?? false;
}
