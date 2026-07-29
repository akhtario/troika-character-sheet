// Pure dice-rolling helpers, shared by character generation and the dice roller UI.
(function (global) {
  "use strict";

  function rollD6() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function rollDice(n, sides) {
    let total = 0;
    for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1;
    return total;
  }

  global.Troika = global.Troika || {};
  global.Troika.dice = { rollD6, rollDice };
})(window);
