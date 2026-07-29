// Character data model, persistence and migration logic.
(function (global) {
  "use strict";

  const { rollDice } = global.Troika.dice;

  const STORAGE_KEY = "troika-characters";
  const ACTIVE_KEY = "troika-active-id";

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function blankCharacter() {
    const stamina = rollDice(2, 6) + 12;
    const luck = rollDice(1, 6) + 6;
    return {
      id: generateId(),
      name: "New Character",
      background: "",
      pronouns: "",
      skill: rollDice(1, 3) + 3,
      staminaCurrent: stamina,
      staminaMax: stamina,
      luckCurrent: luck,
      luckMax: luck,
      skills: [{ name: "", rank: 1 }],
      spells: [],
      abilities: [{ name: "", rank: 1 }],
      unarmedDamage: [1, 1, 1, 2, 2, 3, 4],
      inventory: [
        { name: "Knife", equipped: true, damage: [2, 2, 2, 2, 4, 8, 10] },
        { name: "Lantern", equipped: false, damage: [0, 0, 0, 0, 0, 0, 0] },
        { name: "Flask of Oil", equipped: false, damage: [0, 0, 0, 0, 0, 0, 0] },
        ...Array.from({ length: 9 }, () => ({ name: "", equipped: false, damage: [0, 0, 0, 0, 0, 0, 0] })),
      ],
      provisions: 6,
      pence: rollDice(2, 6),
      armour: 0,
      shield: false,
      notes: "",
    };
  }

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveAll(chars) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chars));
  }

  function getActiveId() {
    return localStorage.getItem(ACTIVE_KEY);
  }

  function setActiveId(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  // Normalizes a character object to the current schema. Safe to call on any
  // character coming from localStorage, a fresh blankCharacter(), or an
  // imported/exported JSON file, regardless of how old it is.
  function migrateCharacter(c) {
    if (!c.abilities) {
      c.abilities = [];
      if (c.skills && c.skills.length) c.abilities.push(...c.skills);
      if (c.spells && c.spells.length) c.abilities.push(...c.spells);
      if (c.abilities.length === 0) c.abilities.push({ name: "", rank: 1 });
    }
    if (!c.inventory) c.inventory = [];
    // Ensure inventory items have damage arrays
    c.inventory.forEach((item) => {
      if (!item.damage) item.damage = [0, 0, 0, 0, 0, 0, 0];
    });
    if (!c.unarmedDamage) c.unarmedDamage = [1, 1, 1, 2, 2, 3, 4];
    if (c.armour === undefined) c.armour = 0;
    if (c.shield === undefined) c.shield = false;
    if (!c.id) c.id = generateId();
    return c;
  }

  global.Troika.storage = {
    STORAGE_KEY,
    ACTIVE_KEY,
    generateId,
    blankCharacter,
    loadAll,
    saveAll,
    getActiveId,
    setActiveId,
    migrateCharacter,
  };
})(window);
