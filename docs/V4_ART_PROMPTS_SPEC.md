# V4 Art Generation Prompts Specification

> **Target Output Directory**: `/Users/jary/WorkBuddy/zaikaiyiju/apps/steam/assets/art/`
> **Integration Rule**: Keep `packages/game-ui/src/assets/AssetLoader.ts` untouched for these files until your AI art colleague delivers the generated assets to `apps/steam/assets/art/`, avoiding runtime 404 console errors while code UI/VFX ships with vector/gradient fallbacks.

---

## Global Visual Style Guide

- **Palette & Atmosphere**: Deep stadium night obsidian (`#080c14`), slate emerald (`#10b981`), tactical cyan (`#22d3ee`), imperial champion gold (`#f59e0b`), and striker crimson (`#ef4444`).
- **Rendering Style**: High-contrast tactical broadcast & prestige RPG craftsmanship — sleek metallic bevels, subtle volumetric rim lighting, sharp silhouettes, clean dark or true-alpha backgrounds for canvas compositing.
- **Hard Negative Constraints (include on every prompt)**:
  `NO text, NO letters, NO numbers, NO watermarks, NO logos, NO UI buttons, NO borders unless explicitly requested, NO cartoon exaggeration, NO low-res blur`.

---

## Module A — 60s Veteran Prologue & Signature Card (5 Assets)

### 1. `prologue_01_tunnel.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: Prologue Slide 1 background — veteran captain walking out into his final match.
- **Prompt**:
  > Cinematic wide-angle view from inside a dark concrete football stadium players' tunnel looking toward blinding emerald-and-gold floodlights shining through mist onto the pitch beyond, silhouette of an experienced veteran football captain seen from behind wearing a worn classic jersey and glowing gold captain's armband on his left arm, dramatic volumetric light rays, rain particles suspended in air, moody prestige sports drama photography, deep obsidian shadows `#080c14` with warm amber stadium rim light, ultra sharp, no text, no watermarks.

### 2. `prologue_02_last_shot.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: Prologue Slide 2 background — decisive final-minute strike in heavy rain.
- **Prompt**:
  > Dramatic low-angle action still inside a rain-soaked floodlit stadium penalty box at night, a seasoned striker mid-air striking a crisp half-volley with flying water droplets and golden stadium flares blurring in the background stand, sleek tactical motion blur trails in amber gold and cyan, intense spotlight beam cutting through drizzle, prestige cinema cinematography, deep slate shadows, no text, no numbers, no scoreboard overlays.

### 3. `prologue_03_farewell.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: Prologue Slide 3 background — retiring boots & captain armband in locker room.
- **Prompt**:
  > Poetic atmospheric close-up inside a quiet timber football dressing room after full-time, warm tungsten desk lamp illuminating mud-stained leather football boots resting beside a folded dark emerald jersey and a captain's armband on a wooden bench, tattered tactical clipboard and whistle in soft focus, dust motes floating in quiet golden light, nostalgic championship storytelling aesthetic, no text, no names.

### 4. `prologue_04_hometown_club.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: Prologue Slide 4 background — returning home to revive the struggling academy club.
- **Prompt**:
  > Atmospheric twilight wide shot of a humble grassroots hometown football academy pitch surrounded by modest concrete terraces and aged steel floodlights turning on against a deep stormy indigo sky, muddy goalmouth turf waiting for revival, a lit glass-walled tactical coach office overlooking the touchline with warm emerald desk glow, hopeful sports drama atmosphere, ultra crisp cinematic lighting, no text, no signage.

### 5. `cmd_captain_roar.png`
- **Specs**: `512x512` (1:1, transparent PNG or pure `#080c14` centered emblem)
- **Usage**: Prologue unique signature Command Card illustration ("Old Captain's Roar").
- **Prompt**:
  > Prestige RPG skill icon illustration centered on dark obsidian backdrop, forged brushed gold crest combining a roaring stylized lion head wrapping around an emerald-trimmed captain's armband emitting concentric shockwave arcs and tactical directional arrows, subtle cyan kinetic sparks, sharp metallic specular highlights, clean icon silhouette, no text, no numbers.

---

## Module B — High-Dopamine UI Screens (8 Assets)

### 6. `pack_recruit.png`
- **Specs**: `512x680` (3:4 vertical, transparent PNG)
- **Usage**: `PostMatchReDraftScreen` — Draft / Recruit pack closed & opening card visual.
- **Prompt**:
  > Sleek futuristic isometric scouting dossier pack isolated on transparent background, matte dark obsidian carbon-fiber casing with brushed titanium clasp, glowing emerald `#10b981` geometric circuit seams and subtle player-silhouette hologram seal in the center, volumetric rim light, triple-A sports card game pack render, sharp edges, no text, no numbers.

### 7. `pack_tactics.png`
- **Specs**: `512x680` (3:4 vertical, transparent PNG)
- **Usage**: `PostMatchReDraftScreen` — Tactical Command Card booster pack.
- **Prompt**:
  > High-tech tactical playbook booster pack isolated on transparent background, slate armor-glass shell etched with glowing cyan `#22d3ee` pitch formation grid lines and vector arrows radiating from a central metallic diamond lock, clean studio rim lighting, triple-A strategy card game asset, no text, no numbers.

### 8. `pack_perk.png`
- **Specs**: `512x680` (3:4 vertical, transparent PNG)
- **Usage**: `PostMatchReDraftScreen` — Rogue Perk / Relic reward chest pack.
- **Prompt**:
  > Prestige gilded tactical relic coffret pack isolated on transparent background, heavy hammered dark bronze and obsidian steel frame inlaid with molten gold `#f59e0b` and crimson `#ef4444` crystalline core gem glowing softly from within, sharp bevel reflections, Diablo-inspired prestige loot styling adapted for modern football strategy, no text, no numbers.

### 9. `pack_burst_fx.png`
- **Specs**: `1024x1024` (1:1, transparent PNG for glow compositing)
- **Usage**: Pack open / card flip burst light layer across `PostMatchReDraftScreen` & `SeasonEndScreen`.
- **Prompt**:
  > Symmetrical radial prismatic light explosion and golden ember shatter isolated on transparent background, crisp shards of champagne gold, cyan, and emerald energy beams bursting outward from an ultra-bright soft center core, clean alpha falloff toward edges so nothing clips, VFX sprite sheet quality, no text, no dark box artifacts.

### 10. `bg_skill_constellation.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: `MetaScreen` tactical Skill Web backdrop under the star-chart nodes.
- **Prompt**:
  > Deep cosmic architectural football astrolabe background, obsidian midnight navy `#060a12` subtly etched with faint concentric brass telescope rings, whisper-faint architectural tactical pitch lines and deep emerald nebula dust `#0a2e26` concentrated toward the center while keeping edges dark and calm for high UI legibility, minimalist luxury dark backdrop, no bright clutter, no text.

### 11. `bg_season_ceremony.jpg`
- **Specs**: `1920x1080` (16:9 widescreen, opaque JPG)
- **Usage**: `SeasonEndScreen` championship / promotion settlement backdrop.
- **Prompt**:
  > Grand football championship ceremony inside a vast nocturnal stadium arena, dual sweeping white-gold spotlight columns intersecting high above an obsidian marble presentation dais, subtle drifting gold confetti glints in deep atmospheric bokeh, dramatic dark slate shadows preserving foreground card contrast, celebratory prestige sports broadcast aesthetic, no crowd faces in sharp focus, no text.

### 12. `trophy_grand_cup.png`
- **Specs**: `768x1024` (3:4 vertical, transparent PNG)
- **Usage**: `SeasonEndScreen` centerpiece champion cup / promotion crest.
- **Prompt**:
  > Masterpiece sculpted championship football trophy isolated on transparent background, heavy fluted solid gold chalice supported by sleek obsidian-steel wing handles cradling a faceted emerald crystal football core at the crown, dramatic rim reflections, museum-grade metallic shader look, no engraved letters or text.

### 13. `card_frame_mythic.png`
- **Specs**: `600x840` (5:7 vertical frame with clean transparent center window, PNG)
- **Usage**: Mythic / Aspect-empowered card frame overlay in draft & hand UI.
- **Prompt**:
  > Ornate vertical trading card border frame with completely transparent hollow center rectangular window, forged brushed obsidian steel outer rim trimmed with molten gold filigree corner crests and subtle glowing cyan crystalline conduits along the left and right rails, razor-sharp crisp edges ready for UI 9-slice or overlay, no background fill inside center, no text.

---

## Module C — Remaining 7 Achievement Medals (512x512 Transparent PNG)

> **Shared Spec for #14–#20**: `512x512` (1:1), **true transparent background**, centered octagonal or circular sculpted metallic championship medallion occupying ~80% of canvas height, crisp obsidian slate enamel + precious metal bevels, zero text/numbers.

### 14. `ach_hattrick.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, octagonal brushed-gold and dark slate medallion featuring three sleek flaming crimson-and-gold footballs orbiting an emerald laurel center crest, dramatic metallic rim highlights, crisp icon clarity, no text, no numbers.

### 15. `ach_clean_sheet.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, heavy titanium-silver shield medallion framed by stylized obsidian goalkeeper gauntlets clutching a glowing cyan `#22d3ee` octagonal barrier crystal, mirror metallic sheen, crisp silhouette, no text, no numbers.

### 16. `ach_craft_card.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, hammered antique bronze and obsidian medallion depicting a glowing tactical forge anvil beneath crossed blueprint compasses and a raised metallic command-card plate with molten sparks, sharp prestige RPG craftsmanship, no text.

### 17. `ach_recipe_5.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, rose-gold and dark slate pentagon medallion inlaid with five interlocking luminous elemental gemstones (crimson, cyan, emerald, steel-blue, gold) spiraling into a central tactical compass star, razor-sharp studio metal render, no text.

### 18. `ach_hidden_trait.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, fractured dark obsidian medallion revealing a radiant crimson-and-gold awakening eye crest glowing from beneath cracked slate armor plates surrounded by subtle runic geometric filigree, dramatic rim lighting, no text.

### 19. `ach_synergy.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, platinum and dark emerald circular medallion featuring three interlocked beveled triangular resonance rings in crimson, cyan, and imperial gold converging into a glowing golden triad prism core, sharp luxury icon style, no text.

### 20. `ach_meta_lv3.png`
- **Prompt**:
  > Sculpted championship achievement medal isolated on transparent background, supreme three-tiered ascending imperial gold astrolabe crown medallion set over deep emerald enamel with radiant orbital starlight arcs, pinnacle achievement prestige finish, crisp edges, no text.

---

## Module D — Skill Cut-In VFX Bands (3 Assets)

> **Shared Spec for #21–#23**: `1280x320` (4:1 wide horizontal banner, transparent PNG), directional left-to-right kinetic energy band with feathered alpha edges so UI text and player callouts stay readable in the center.

### 21. `fx_skill_cutin_att.png`
- **Prompt**:
  > Wide horizontal 4:1 VFX energy slash ribbon isolated on transparent background, supersonic twin crimson `#ef4444` and molten gold `#f59e0b` blade arcs sweeping dynamically left to right with trailing kinetic sparks and angular speed-lines, center translucent enough for crisp foreground typography overlay, clean alpha edges, no text.

### 22. `fx_skill_cutin_def.png`
- **Prompt**:
  > Wide horizontal 4:1 VFX shield shockwave band isolated on transparent background, crystalline emerald `#10b981` and ice-cyan `#22d3ee` hexagonal kinetic barrier ripples sweeping outward horizontally with sleek translucent forcefield shards, clean feathered alpha border, no text.

### 23. `fx_skill_cutin_ult.png`
- **Prompt**:
  > Wide horizontal 4:1 VFX ultimate astral surge ribbon isolated on transparent background, imperial molten gold `#f59e0b` lightning tendrils interwoven with deep emerald-cyan celestial plasma shockwaves arcing across the frame, high-impact prestige game cut-in flash effect, clean alpha falloff, no text.
