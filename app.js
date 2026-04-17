(() => {
  "use strict";

  const STORAGE_KEY = "troika-characters";
  const ACTIVE_KEY = "troika-active-id";

  // === Data helpers ===

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function rollDice(n, sides) {
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
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

  // === State ===

  let characters = loadAll();
  let current = null;

  function ensureAtLeastOne() {
    if (characters.length === 0) {
      characters.push(blankCharacter());
      saveAll(characters);
    }
  }

  function findChar(id) {
    return characters.find((c) => c.id === id);
  }

  function saveCurrent() {
    if (!current) return;
    const idx = characters.findIndex((c) => c.id === current.id);
    if (idx !== -1) characters[idx] = current;
    saveAll(characters);
  }

  // === DOM refs ===

  const $ = (sel) => document.querySelector(sel);
  const charSelect = $("#character-select");

  // === Populate character selector ===

  function populateSelector() {
    charSelect.innerHTML = "";
    characters.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name || "Unnamed";
      charSelect.appendChild(opt);
    });
    if (current) charSelect.value = current.id;
  }

  // === Render character into form ===

  function renderCharacter() {
    if (!current) return;

    // Simple fields
    const simpleFields = [
      "name", "background", "pronouns", "skill",
      "staminaCurrent", "staminaMax", "luckCurrent", "luckMax",
      "provisions", "pence", "notes",
    ];
    simpleFields.forEach((key) => {
      const el = document.querySelector(`[data-key="${key}"]`);
      if (el) el.value = current[key] ?? "";
    });

    renderAbilities();
    renderInventory();
    renderWeapons();
    populateRollTargets();
  }

  // === Migration: merge old skills/spells into abilities ===

  function migrateCharacter(c) {
    if (!c.abilities) {
      c.abilities = [];
      if (c.skills && c.skills.length) c.abilities.push(...c.skills);
      if (c.spells && c.spells.length) c.abilities.push(...c.spells);
      if (c.abilities.length === 0) c.abilities.push({ name: "", rank: 1 });
    }
    // Ensure inventory items have damage arrays
    if (c.inventory) {
      c.inventory.forEach((item) => {
        if (!item.damage) item.damage = [0, 0, 0, 0, 0, 0, 0];
      });
    }
    if (c.armour === undefined) c.armour = 0;
    if (c.shield === undefined) c.shield = false;
    return c;
  }

  // === Abilities list rendering ===

  function renderAbilities() {
    const container = $("#abilities-list");
    container.innerHTML = "";
    const baseSkill = current.skill || 0;
    const items = current.abilities || [];
    items.forEach((item, i) => {
      const total = (item.rank || 0) + baseSkill;
      const row = document.createElement("div");
      row.className = "list-row ability-row";
      row.innerHTML = `
        <input type="checkbox" ${item.used ? "checked" : ""} data-list="abilities" data-index="${i}" data-field="used" title="Successful use">
        <input type="text" value="${escHtml(item.name)}" placeholder="Skill or spell name" data-list="abilities" data-index="${i}" data-field="name">
        <input type="number" value="${item.rank}" min="0" max="99" data-list="abilities" data-index="${i}" data-field="rank">
        <span class="calc-plus">+</span>
        <span class="calc-skill">${baseSkill}</span>
        <span class="calc-eq">=</span>
        <span class="calc-total">${total}</span>
        <button class="btn-remove" data-list="abilities" data-index="${i}" title="Remove">&times;</button>
      `;
      container.appendChild(row);
    });

    if ($(".abilities").classList.contains("edit-mode")) {
      const addBtn = document.createElement("button");
      addBtn.className = "btn-add";
      addBtn.id = "btn-add-ability";
      addBtn.textContent = "+ Add Skill / Spell";
      container.appendChild(addBtn);
    }
  }

  function getMaxSlots() {
    const armour = current.armour || 0;
    const shield = current.shield ? 1 : 0;
    return 12 - (armour * 2) - shield;
  }

  function renderInventory() {
    const container = $("#inventory-list");
    container.innerHTML = "";
    const maxSlots = getMaxSlots();
    // Ensure inventory always has 12 slots in data
    while (current.inventory.length < 12) {
      current.inventory.push({ name: "", equipped: false, damage: [0, 0, 0, 0, 0, 0, 0] });
    }
    const items = current.inventory.slice(0, maxSlots);
    items.forEach((item, i) => {
      // Ensure damage array exists (migration for old data)
      if (!item.damage) item.damage = [0, 0, 0, 0, 0, 0, 0];
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <span class="slot-num">${i + 1}</span>
        <input type="text" value="${escHtml(item.name)}" placeholder="Item" data-list="inventory" data-index="${i}" data-field="name">
        <input type="checkbox" ${item.equipped ? "checked" : ""} data-list="inventory" data-index="${i}" data-field="equipped" title="Equipped weapon">
      `;
      container.appendChild(row);
    });

    // Update armour dropdown, shield checkbox, AV and slot info
    const armourSelect = $("#armour-select");
    armourSelect.value = current.armour || 0;
    $("#shield-check").checked = !!current.shield;
    const av = (current.armour || 0) + (current.shield ? 1 : 0);
    $("#armour-av").textContent = `(AV: ${av})`;
    $("#armour-slots-info").textContent = `(${maxSlots} Slots)`;

    renderWeapons();
  }

  function renderWeapons() {
    const container = $("#weapons-list");
    const emptyMsg = $("#weapons-empty");
    container.innerHTML = "";

    // Always render Unarmed first
    if (!current.unarmedDamage) current.unarmedDamage = [1, 1, 1, 2, 2, 3, 4];
    const unarmedRow = document.createElement("div");
    unarmedRow.className = "weapon-row";
    const unarmedInputs = current.unarmedDamage
      .map((val, di) => `<input type="number" value="${val}" min="0" max="99" data-unarmed="true" data-dmg-index="${di}" title="Damage roll ${di + 1}${di === 6 ? "+" : ""}">`)
      .join("");
    unarmedRow.innerHTML = `<span class="weapon-name">Unarmed</span>${unarmedInputs}`;
    container.appendChild(unarmedRow);

    const weapons = (current.inventory || [])
      .map((item, i) => ({ item, index: i }))
      .filter(({ item }) => item.equipped);

    emptyMsg.style.display = "none";

    weapons.forEach(({ item, index }) => {
      if (!item.damage) item.damage = [0, 0, 0, 0, 0, 0, 0];
      const row = document.createElement("div");
      row.className = "weapon-row";
      const dmgInputs = item.damage
        .map((val, di) => `<input type="number" value="${val}" min="0" max="99" data-weapon-index="${index}" data-dmg-index="${di}" title="Damage roll ${di + 1}${di === 6 ? "+" : ""}">`)
        .join("");
      row.innerHTML = `<span class="weapon-name" title="${escHtml(item.name)}">${escHtml(item.name || "Unnamed")}</span>${dmgInputs}`;
      container.appendChild(row);
    });
  }

  function escHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // === Event: simple field changes ===

  document.addEventListener("input", (e) => {
    if (!current) return;
    const key = e.target.dataset.key;
    if (key) {
      const val = e.target.type === "number" ? Number(e.target.value) : e.target.value;
      current[key] = val;
      if (key === "name") {
        const opt = charSelect.querySelector(`option[value="${current.id}"]`);
        if (opt) opt.textContent = val || "Unnamed";
      }
      if (key === "skill") {
        renderAbilities();
        populateRollTargets();
      }
      saveCurrent();
      return;
    }

    // List fields
    const list = e.target.dataset.list;
    if (list) {
      const idx = Number(e.target.dataset.index);
      const field = e.target.dataset.field;
      if (field === "equipped") {
        current[list][idx][field] = e.target.checked;
      } else if (e.target.type === "number") {
        current[list][idx][field] = Number(e.target.value);
        // Update total display inline for abilities without full re-render
        if (list === "abilities" && field === "rank") {
          const row = e.target.closest(".ability-row");
          if (row) {
            const totalEl = row.querySelector(".calc-total");
            if (totalEl) totalEl.textContent = Number(e.target.value) + (current.skill || 0);
          }
          populateRollTargets();
        }
      } else {
        current[list][idx][field] = e.target.value;
        // Sync weapon name display when inventory item name changes
        if (list === "inventory" && field === "name" && current[list][idx].equipped) {
          renderWeapons();
        }
        if (list === "abilities" && field === "name") {
          populateRollTargets();
        }
      }
      saveCurrent();
      return;
    }

    // Unarmed damage inputs
    if (e.target.dataset.unarmed) {
      const dmgIdx = Number(e.target.dataset.dmgIndex);
      if (!current.unarmedDamage) current.unarmedDamage = [1, 1, 1, 2, 2, 3, 4];
      current.unarmedDamage[dmgIdx] = Number(e.target.value) || 0;
      saveCurrent();
      return;
    }

    // Weapon damage inputs
    const weaponIdx = e.target.dataset.weaponIndex;
    if (weaponIdx !== undefined) {
      const dmgIdx = Number(e.target.dataset.dmgIndex);
      const invIdx = Number(weaponIdx);
      if (!current.inventory[invIdx].damage) current.inventory[invIdx].damage = [0, 0, 0, 0, 0, 0, 0];
      current.inventory[invIdx].damage[dmgIdx] = Number(e.target.value) || 0;
      saveCurrent();
    }
  });

  // checkbox change event (doesn't fire "input" in all browsers)
  document.addEventListener("change", (e) => {
    if (!current) return;
    if (e.target.type === "checkbox" && e.target.dataset.list) {
      const idx = Number(e.target.dataset.index);
      current[e.target.dataset.list][idx][e.target.dataset.field] = e.target.checked;
      saveCurrent();
      if (e.target.dataset.field === "equipped") renderWeapons();
    }
  });

  // === Event: remove buttons ===

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-remove");
    if (!btn || !current) return;
    const list = btn.dataset.list;
    const idx = Number(btn.dataset.index);
    current[list].splice(idx, 1);
    saveCurrent();
    if (list === "inventory") renderInventory();
    else if (list === "abilities") {
      renderAbilities();
      populateRollTargets();
    }
  });

  // === Event: add buttons ===

  $("#btn-edit-abilities").addEventListener("click", () => {
    $(".abilities").classList.toggle("edit-mode");
    renderAbilities();
  });

  $("#btn-edit-weapons").addEventListener("click", () => {
    $(".weapons").classList.toggle("edit-mode");
  });

  $("#btn-edit-identity").addEventListener("click", () => {
    $(".identity").classList.toggle("edit-mode");
  });

  $("#btn-edit-inventory").addEventListener("click", () => {
    $(".inventory").classList.toggle("edit-mode");
  });

  $("#btn-edit-provisions").addEventListener("click", () => {
    $(".provisions-money").classList.toggle("edit-mode");
  });

  document.addEventListener("click", (e) => {
    if (e.target.id === "btn-add-ability") {
      if (!current) return;
      current.abilities.push({ name: "", rank: 1 });
      saveCurrent();
      renderAbilities();
      populateRollTargets();
    }
  });

  $("#armour-select").addEventListener("change", (e) => {
    if (!current) return;
    current.armour = Number(e.target.value);
    saveCurrent();
    renderInventory();
  });

  $("#shield-check").addEventListener("change", (e) => {
    if (!current) return;
    current.shield = e.target.checked;
    saveCurrent();
    renderInventory();
  });

  // === Character management ===

  $("#btn-new-char").addEventListener("click", () => {
    const c = blankCharacter();
    characters.push(c);
    saveAll(characters);
    current = c;
    setActiveId(c.id);
    populateSelector();
    renderCharacter();
  });

  // === Custom Confirm Modal ===
  const confirmOverlay = $("#confirm-modal");
  const confirmMsg = $("#confirm-modal-msg");
  const confirmOk = $("#confirm-modal-ok");
  const confirmCancel = $("#confirm-modal-cancel");
  let confirmCallback = null;

  function showConfirm(message, onConfirm) {
    confirmMsg.textContent = message;
    confirmCallback = onConfirm;
    confirmOverlay.hidden = false;
  }

  confirmOk.addEventListener("click", () => {
    confirmOverlay.hidden = true;
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  confirmCancel.addEventListener("click", () => {
    confirmOverlay.hidden = true;
    confirmCallback = null;
  });

  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) {
      confirmOverlay.hidden = true;
      confirmCallback = null;
    }
  });

  $("#btn-delete-char").addEventListener("click", () => {
    if (!current) return;
    const isLast = characters.length <= 1;
    const msg = isLast
      ? `Delete "${current.name}"? A new blank character will be created.`
      : `Delete "${current.name}"?`;
    confirmOk.style.display = "";
    showConfirm(msg, () => {
      characters = characters.filter((c) => c.id !== current.id);
      if (characters.length === 0) {
        const blank = blankCharacter();
        characters.push(blank);
      }
      saveAll(characters);
      current = characters[0];
      setActiveId(current.id);
      populateSelector();
      renderCharacter();
    });
  });

  charSelect.addEventListener("change", () => {
    current = findChar(charSelect.value);
    if (current) {
      setActiveId(current.id);
      renderCharacter();
    }
  });

  // === Dice Roller ===

  function populateRollTargets() {
    const sel = $("#roll-target");
    const prev = sel.value;
    sel.innerHTML = "";
    const baseSkill = current ? current.skill || 0 : 0;
    // Base skill option
    const baseOpt = document.createElement("option");
    baseOpt.value = baseSkill;
    baseOpt.textContent = `Skill (${baseSkill})`;
    sel.appendChild(baseOpt);
    // Abilities
    if (current && current.abilities) {
      current.abilities.forEach((ab) => {
        if (!ab.name) return;
        const total = (ab.rank || 0) + baseSkill;
        const opt = document.createElement("option");
        opt.value = total;
        opt.textContent = `${ab.name} (${total})`;
        sel.appendChild(opt);
      });
    }
    // Restore previous selection if still valid
    const options = Array.from(sel.options);
    const match = options.find((o) => o.textContent === prev || o.value === prev);
    if (match) sel.value = match.value;
  }

  function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function showResult(html, className) {
    const el = $("#dice-result");
    el.innerHTML = html;
    el.className = "dice-result" + (className ? " " + className : "");
  }

  $("#btn-roll-d6").addEventListener("click", () => {
    const r = rollD6();
    showResult(`<span class="roll-value">${r}</span><span class="roll-detail">d6</span>`);
  });

  $("#btn-roll-2d6").addEventListener("click", () => {
    const a = rollD6(), b = rollD6();
    showResult(`<span class="roll-value">${a + b}</span><span class="roll-detail">${a} + ${b}</span>`);
  });

  $("#btn-roll-d66").addEventListener("click", () => {
    const tens = rollD6(), ones = rollD6();
    showResult(`<span class="roll-value">${tens}${ones}</span><span class="roll-detail">d66 (${tens} tens, ${ones} ones)</span>`);
  });

  $("#btn-roll-under").addEventListener("click", () => {
    const sel = $("#roll-target");
    const target = Number(sel.value) || 0;
    const label = sel.options[sel.selectedIndex]?.textContent || target;
    const a = rollD6(), b = rollD6();
    const total = a + b;
    const pass = total <= target;
    showResult(
      `<span class="roll-value">${total}</span><span class="roll-detail">${a} + ${b} vs ${label} &mdash; ${pass ? "PASS" : "FAIL"}</span>`,
      pass ? "pass" : "fail"
    );
  });

  // === Import / Export ===

  $("#btn-export").addEventListener("click", async () => {
    if (!current) return;
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const fileName = `${(current.name || "character").replace(/\s+/g, "_")}.json`;

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON File", accept: { "application/json": [".json"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (e) {
        if (e.name !== "AbortError") console.error(e);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  $("#btn-import").addEventListener("click", () => {
    $("#import-file").click();
  });

  $("#import-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.name && !data.skill) {
          alert("This doesn't look like a valid Troika character file.");
          return;
        }
        data.id = generateId(); // always assign a new id on import
        characters.push(data);
        saveAll(characters);
        current = data;
        setActiveId(data.id);
        populateSelector();
        renderCharacter();
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // === Init ===

  ensureAtLeastOne();
  characters.forEach(migrateCharacter);
  const activeId = getActiveId();
  current = findChar(activeId) || characters[0];
  migrateCharacter(current);
  setActiveId(current.id);
  populateSelector();
  renderCharacter();
})();
