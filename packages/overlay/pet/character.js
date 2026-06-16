// Kawaii SVG character system for the desktop pet.
// One shared "rig" (body, ears, eyes, cheeks, tail) + per-animal colors, ear
// type and signature features. Pure SVG, no dependencies. Animatable: parts
// carry classes (.eye, .breathe, .tail, .mouth-*) that pet.html drives for
// blink / breathe / wag / sleep / sad.
//
// Exposes window.TreatsCharacter.build(animalKey) -> SVG markup string.
(function () {
  // palette + features per animal. earType: droopy|pointy|round|long|horns|tuft|none
  const SPECS = {
    dog:     { body: "#E0A86A", belly: "#F6E6CC", ear: "#C0824A", line: "#5A3B22", cheek: "#F49AA0", ear: "#C0824A", earType: "droopy" },
    cat:     { body: "#9AA2B1", belly: "#E9ECF3", ear: "#7C8493", line: "#3D4350", cheek: "#F49AA0", earType: "pointy", whiskers: true },
    fox:     { body: "#EE8B3D", belly: "#FBEFE0", ear: "#EE8B3D", line: "#5A3115", cheek: "#F7B38A", earType: "pointy", earTip: "#3A2410", muzzle: "#FBEFE0" },
    panda:   { body: "#F4F4F2", belly: "#FFFFFF", ear: "#2C2C2C", line: "#2C2C2C", cheek: "#F7C6CC", earType: "round", eyePatch: "#2C2C2C" },
    hamster: { body: "#E9C781", belly: "#FBF1D8", ear: "#D8AF63", line: "#6A4A22", cheek: "#F49AA0", earType: "round" },
    rabbit:  { body: "#ECE6E0", belly: "#FFFFFF", ear: "#ECE6E0", line: "#6B5E54", cheek: "#F7B9C0", earType: "long", earInner: "#F6C9CE" },
    horse:   { body: "#B58A5E", belly: "#E9D7BE", ear: "#9C7547", line: "#4A3320", cheek: "#E1A07F", earType: "pointy", mane: "#5A3D24" },
    parrot:  { body: "#3FAE63", belly: "#F2D451", ear: "#2E8C4C", line: "#1E5C33", cheek: "#F08", earType: "tuft", beak: "#F2A03D", wing: "#2E8C4C" },
    dragon:  { body: "#7FC081", belly: "#D6EFD0", ear: "#5FA463", line: "#234A28", cheek: "#9FD79C", earType: "horns", horn: "#EFE3B8", wing: "#5FA463", spike: "#4E8C52" },
    frog:    { body: "#86CB5C", belly: "#CDE8A0", ear: "none", line: "#3C6B22", cheek: "#9CD27A", earType: "none", topEyes: true, wideMouth: true },
    penguin: { body: "#3A3F4B", belly: "#FFFFFF", ear: "none", line: "#22252E", cheek: "#F7C6CC", earType: "none", beak: "#F2A03D", face: "#FFFFFF", feet: "#F2A03D" },
    bee:     { body: "#F4C20A", belly: "#FBE7A0", ear: "none", line: "#3A2E08", cheek: "#F49AA0", earType: "none", stripes: "#2E2608", wings: true, antennae: true },
  };

  const mirror = (x) => 120 - x;

  // --- ears (left + right, mirrored across x=60) ---
  function ears(s) {
    const t = s.earType;
    if (t === "none") return "";
    const L = [];
    if (t === "droopy") {
      // soft hanging ears beside the head
      L.push(`<path class="ear" d="M40,40 C24,40 18,60 26,76 C34,84 44,76 44,62 Z" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5"/>`);
      L.push(`<path class="ear" d="M80,40 C96,40 102,60 94,76 C86,84 76,76 76,62 Z" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5"/>`);
    } else if (t === "pointy") {
      const tip = s.earTip || s.ear;
      L.push(`<path class="ear" d="M34,46 L30,18 L54,38 Z" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5" stroke-linejoin="round"/>`);
      L.push(`<path class="ear" d="M86,46 L90,18 L66,38 Z" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5" stroke-linejoin="round"/>`);
      if (s.earTip) {
        L.push(`<path d="M34,46 L31.5,28 L44,40 Z" fill="${tip}"/>`);
        L.push(`<path d="M86,46 L88.5,28 L76,40 Z" fill="${tip}"/>`);
      }
    } else if (t === "round") {
      L.push(`<circle class="ear" cx="36" cy="36" r="13" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5"/>`);
      L.push(`<circle class="ear" cx="84" cy="36" r="13" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5"/>`);
    } else if (t === "long") {
      const inner = s.earInner || s.belly;
      L.push(`<g class="ear"><ellipse cx="44" cy="22" rx="8" ry="22" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5" transform="rotate(-10 44 22)"/><ellipse cx="44" cy="24" rx="3.5" ry="15" fill="${inner}" transform="rotate(-10 44 22)"/></g>`);
      L.push(`<g class="ear"><ellipse cx="76" cy="22" rx="8" ry="22" fill="${s.ear}" stroke="${s.line}" stroke-width="2.5" transform="rotate(10 76 22)"/><ellipse cx="76" cy="24" rx="3.5" ry="15" fill="${inner}" transform="rotate(10 76 22)"/></g>`);
    } else if (t === "horns") {
      L.push(`<path class="ear" d="M40,34 L34,14 L48,30 Z" fill="${s.horn}" stroke="${s.line}" stroke-width="2" stroke-linejoin="round"/>`);
      L.push(`<path class="ear" d="M80,34 L86,14 L72,30 Z" fill="${s.horn}" stroke="${s.line}" stroke-width="2" stroke-linejoin="round"/>`);
    } else if (t === "tuft") {
      L.push(`<path class="ear" d="M52,30 C50,14 60,10 60,10 C60,10 70,14 68,30 Z" fill="${s.ear}" stroke="${s.line}" stroke-width="2" stroke-linejoin="round"/>`);
    }
    return L.join("");
  }

  // --- signature extras behind/over the body ---
  function behind(s) {
    const L = [];
    if (s.wings) {
      L.push(`<ellipse class="wing" cx="30" cy="58" rx="16" ry="22" fill="#FFFFFF" opacity="0.55" stroke="${s.line}" stroke-width="1.5" transform="rotate(-18 30 58)"/>`);
      L.push(`<ellipse class="wing" cx="90" cy="58" rx="16" ry="22" fill="#FFFFFF" opacity="0.55" stroke="${s.line}" stroke-width="1.5" transform="rotate(18 90 58)"/>`);
    }
    if (s.wing && !s.wings) {
      L.push(`<path class="tail" d="M86,70 C104,64 110,82 96,92 C88,96 82,86 82,78 Z" fill="${s.wing}" stroke="${s.line}" stroke-width="2.5"/>`);
    }
    return L.join("");
  }

  function tail(s) {
    if (s.earType === "none" || s.wings || s.penguinNoTail) return "";
    if (s.wing) return ""; // wing replaces tail visually
    return `<path class="tail" d="M88,84 C106,80 110,98 96,104 C89,107 84,98 84,90 Z" fill="${s.body}" stroke="${s.line}" stroke-width="2.5"/>`;
  }

  function bodyAndFace(s) {
    const L = [];
    // feet
    L.push(`<ellipse cx="46" cy="106" rx="11" ry="7" fill="${s.body}" stroke="${s.line}" stroke-width="2.5"/>`);
    L.push(`<ellipse cx="74" cy="106" rx="11" ry="7" fill="${s.feet || s.body}" stroke="${s.line}" stroke-width="2.5"/>`);
    // body blob
    L.push(`<g class="breathe"><path d="M60,28 C88,28 99,52 99,76 C99,100 82,110 60,110 C38,110 21,100 21,76 C21,52 32,28 60,28 Z" fill="${s.body}" stroke="${s.line}" stroke-width="2.5"/>`);
    // belly / face panel
    if (s.face) {
      L.push(`<ellipse cx="60" cy="74" rx="26" ry="30" fill="${s.face}"/>`);
      L.push(`<ellipse cx="60" cy="92" rx="20" ry="20" fill="${s.belly}"/>`);
    } else {
      L.push(`<ellipse cx="60" cy="86" rx="22" ry="22" fill="${s.belly}"/>`);
    }
    if (s.muzzle) L.push(`<ellipse cx="60" cy="84" rx="16" ry="13" fill="${s.muzzle}"/>`);
    // bee stripes — on the lower abdomen, clear of the face
    if (s.stripes) {
      L.push(`<path d="M30,90 C44,87 76,87 90,90 L89,97 C76,94 44,94 31,97 Z" fill="${s.stripes}"/>`);
      L.push(`<path d="M35,100 C46,98 74,98 85,100 L84,106 C74,104 46,104 36,106 Z" fill="${s.stripes}"/>`);
    }
    L.push(`</g>`); // close breathe
    return L.join("");
  }

  function face(s) {
    const L = [];
    const ey = s.topEyes ? 50 : 70; // frog eyes ride higher
    const exL = 49, exR = 71;
    // panda eye patches
    if (s.eyePatch) {
      L.push(`<ellipse cx="${exL}" cy="${ey}" rx="10" ry="12" fill="${s.eyePatch}" transform="rotate(18 ${exL} ${ey})"/>`);
      L.push(`<ellipse cx="${exR}" cy="${ey}" rx="10" ry="12" fill="${s.eyePatch}" transform="rotate(-18 ${exR} ${ey})"/>`);
    }
    // frog eye bumps
    if (s.topEyes) {
      L.push(`<circle cx="${exL}" cy="${ey}" r="13" fill="${s.body}" stroke="${s.line}" stroke-width="2.5"/>`);
      L.push(`<circle cx="${exR}" cy="${ey}" r="13" fill="${s.body}" stroke="${s.line}" stroke-width="2.5"/>`);
    }
    // eyes (blinkable)
    const eye = (cx) =>
      `<g class="eye"><ellipse cx="${cx}" cy="${ey}" rx="6.5" ry="8.5" fill="#2A2A30"/>` +
      `<circle cx="${cx + 2.3}" cy="${ey - 3}" r="2.4" fill="#fff"/>` +
      `<circle cx="${cx - 1.8}" cy="${ey + 2}" r="1.2" fill="#fff" opacity="0.8"/></g>`;
    L.push(eye(exL));
    L.push(eye(exR));
    // cheeks
    const cy2 = ey + 14;
    L.push(`<ellipse class="cheek" cx="${exL - 7}" cy="${cy2}" rx="6" ry="4" fill="${s.cheek}" opacity="0.55"/>`);
    L.push(`<ellipse class="cheek" cx="${exR + 7}" cy="${cy2}" rx="6" ry="4" fill="${s.cheek}" opacity="0.55"/>`);
    // nose / beak / mouth
    const ny = ey + 9;
    if (s.beak) {
      L.push(`<path d="M54,${ny} L66,${ny} L60,${ny + 9} Z" fill="${s.beak}" stroke="${s.line}" stroke-width="2" stroke-linejoin="round"/>`);
    } else if (s.wideMouth) {
      L.push(`<path class="mouth-smile" d="M44,${ny + 4} Q60,${ny + 18} 76,${ny + 4}" fill="none" stroke="${s.line}" stroke-width="2.6" stroke-linecap="round"/>`);
      L.push(`<ellipse cx="60" cy="${ny}" rx="3.5" ry="2.5" fill="${s.line}"/>`);
    } else {
      L.push(`<ellipse cx="60" cy="${ny}" rx="4" ry="3" fill="${s.line}"/>`);
      L.push(`<path class="mouth-smile" d="M53,${ny + 5} Q60,${ny + 11} 67,${ny + 5}" fill="none" stroke="${s.line}" stroke-width="2.4" stroke-linecap="round"/>`);
    }
    // frown shown only when sad
    L.push(`<path class="mouth-frown" d="M52,${ny + 10} Q60,${ny + 3} 68,${ny + 10}" fill="none" stroke="${s.line}" stroke-width="2.4" stroke-linecap="round"/>`);
    // whiskers (cat)
    if (s.whiskers) {
      L.push(`<g stroke="${s.line}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"><path d="M40,${ny} L26,${ny - 3}"/><path d="M40,${ny + 3} L26,${ny + 4}"/><path d="M80,${ny} L94,${ny - 3}"/><path d="M80,${ny + 3} L94,${ny + 4}"/></g>`);
    }
    // mane (horse)
    if (s.mane) {
      L.push(`<path d="M60,26 C50,30 50,40 56,42 C54,34 60,30 60,30 C60,30 66,34 64,42 C70,40 70,30 60,26 Z" fill="${s.mane}"/>`);
    }
    // antennae (bee)
    if (s.antennae) {
      L.push(`<g stroke="${s.line}" stroke-width="2" fill="${s.line}" stroke-linecap="round"><path d="M52,34 C48,22 44,20 42,16" fill="none"/><circle cx="42" cy="15" r="2.6"/><path d="M68,34 C72,22 76,20 78,16" fill="none"/><circle cx="78" cy="15" r="2.6"/></g>`);
    }
    return L.join("");
  }

  function build(animalKey) {
    const s = SPECS[animalKey] || SPECS.dog;
    return (
      `<svg class="pet-svg" viewBox="0 0 120 122" xmlns="http://www.w3.org/2000/svg">` +
      `<ellipse class="shadow" cx="60" cy="116" rx="33" ry="6" fill="#000" opacity="0.16"/>` +
      behind(s) +
      tail(s) +
      ears(s) +
      bodyAndFace(s) +
      face(s) +
      `</svg>`
    );
  }

  window.TreatsCharacter = { build, animals: Object.keys(SPECS) };
})();
