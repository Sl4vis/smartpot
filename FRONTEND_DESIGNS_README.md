# SmartPot frontend — minimalistické dizajny

Hotové úpravy:

- prerobený `frontend/src/components/Dashboard.jsx`,
- pridaný prepínač medzi 4 dizajnmi,
- ponechaná oprava online/offline stavu v `frontend/src/utils/deviceStatus.js`,
- priložené vizuálne návrhy v `docs/designs/` aj vo `frontend/public/designs/`.

Dizajny v dashboarde:

1. Premium iOS — najviac odporúčaný finálny štýl.
2. Clean Plant — svetlé rastlinné karty.
3. Dark Minimal — tmavý IoT dashboard.
4. Ultra Minimal — jednoduchý textový prehľad.

Spustenie:

```powershell
cd frontend
npm install
npm run dev
```

Build:

```powershell
cd frontend
npm run build
```

Poznámka: v tomto prostredí neboli nainštalované node_modules, takže finálny build som tu nevedel overiť. Kód je pripravený na Vite/React projekt.
