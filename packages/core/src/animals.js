// Shared animal themes. Pick your animal (`treats animal <key>` or on the
// website) and the whole thing — emoji, treat, ranks, phrasing — adapts.
//
// `tiers` is ordered top → bottom and lines up with the thresholds in
// grades.js: [valedictorian, honorRoll, goldStar, goodStanding,
// needsTraining, detention, suspended].

export const ANIMALS = {
  dog: {
    key: "dog",
    label: "Dog",
    emoji: "🐶",
    treat: "🦴",
    voice: "Woof!",
    give: "Treat given",
    scold: "Bad dog",
    badPhrase: "a bad dog",
    speak: "Bad dog.",
    tiers: [
      { name: "Best Boy", emoji: "🏆" },
      { name: "Very Good Boy", emoji: "🌟" },
      { name: "Good Boy", emoji: "⭐" },
      { name: "Good Pup", emoji: "🐶" },
      { name: "Needs Training", emoji: "⚠️" },
      { name: "Bad Dog", emoji: "🚫" },
      { name: "Doghouse", emoji: "⛔" },
    ],
  },

  cat: {
    key: "cat",
    label: "Cat",
    emoji: "🐱",
    treat: "🐟",
    voice: "Meow!",
    give: "Treat given",
    scold: "Bad cat",
    badPhrase: "a bad cat",
    speak: "Bad cat.",
    tiers: [
      { name: "Top Cat", emoji: "🏆" },
      { name: "Purrfect", emoji: "🌟" },
      { name: "Good Kitty", emoji: "⭐" },
      { name: "Fine Feline", emoji: "🐱" },
      { name: "Needs Training", emoji: "⚠️" },
      { name: "Bad Cat", emoji: "🚫" },
      { name: "Spray Bottle", emoji: "⛔" },
    ],
  },

  dragon: {
    key: "dragon",
    label: "Dragon",
    emoji: "🐉",
    treat: "💎",
    voice: "Rawr!",
    give: "Hoard grows",
    scold: "Disgraced",
    badPhrase: "a disgrace to the hoard",
    speak: "Disgraced.",
    tiers: [
      { name: "Elder Wyrm", emoji: "🏆" },
      { name: "Great Wyrm", emoji: "🌟" },
      { name: "Fine Dragon", emoji: "⭐" },
      { name: "Hatchling", emoji: "🐉" },
      { name: "Restless", emoji: "⚠️" },
      { name: "Disgraced", emoji: "🚫" },
      { name: "Banished", emoji: "⛔" },
    ],
  },

  horse: {
    key: "horse",
    label: "Horse",
    emoji: "🐴",
    treat: "🥕",
    voice: "Neigh!",
    give: "Carrot given",
    scold: "Whoa, bad horse",
    badPhrase: "a stubborn mule",
    speak: "Whoa. Bad horse.",
    tiers: [
      { name: "Derby Winner", emoji: "🏆" },
      { name: "Champion", emoji: "🌟" },
      { name: "Good Horse", emoji: "⭐" },
      { name: "Good Foal", emoji: "🐴" },
      { name: "Needs Training", emoji: "⚠️" },
      { name: "Stubborn Mule", emoji: "🚫" },
      { name: "Out to Pasture", emoji: "⛔" },
    ],
  },

  hamster: {
    key: "hamster",
    label: "Hamster",
    emoji: "🐹",
    treat: "🌰",
    voice: "Squeak!",
    give: "Seed given",
    scold: "Bad hammy",
    badPhrase: "a bad hammy",
    speak: "Bad hammy.",
    tiers: [
      { name: "Wheel Champion", emoji: "🏆" },
      { name: "Very Good Hammy", emoji: "🌟" },
      { name: "Good Hammy", emoji: "⭐" },
      { name: "Fluffball", emoji: "🐹" },
      { name: "Needs Training", emoji: "⚠️" },
      { name: "Bad Hammy", emoji: "🚫" },
      { name: "No Wheel", emoji: "⛔" },
    ],
  },

  parrot: {
    key: "parrot",
    label: "Parrot",
    emoji: "🦜",
    treat: "🥜",
    voice: "Squawk!",
    give: "Peanut given",
    scold: "Bad bird",
    badPhrase: "a bad bird",
    speak: "Bad bird. No peanut.",
    tiers: [
      { name: "Top Bird", emoji: "🏆" },
      { name: "Very Good Bird", emoji: "🌟" },
      { name: "Good Bird", emoji: "⭐" },
      { name: "Fledgling", emoji: "🦜" },
      { name: "Needs Training", emoji: "⚠️" },
      { name: "Bad Bird", emoji: "🚫" },
      { name: "Covered Cage", emoji: "⛔" },
    ],
  },
};

export const DEFAULT_ANIMAL = "dog";

export function getAnimal(key) {
  return ANIMALS[key] || ANIMALS[DEFAULT_ANIMAL];
}

export function animalKeys() {
  return Object.keys(ANIMALS);
}
