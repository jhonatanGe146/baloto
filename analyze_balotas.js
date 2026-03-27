const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'balotas.json');
const README_FILE = path.join(__dirname, 'README.md');

function yearOf(fecha) {
  try {
    return new Date(fecha).getFullYear();
  } catch (e) {
    return null;
  }
}

function nCr(n, r) {
  let num = 1, den = 1;
  for (let i = 0; i < r; i++) {
    num *= (n - i);
    den *= (i + 1);
  }
  return num / den;
}

function analyze() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const all = JSON.parse(raw);

  const fromYear = 2021, toYear = 2026;
  const draws = all.filter(d => {
    const y = yearOf(d.fecha_sorteo);
    return y >= fromYear && y <= toYear;
  });

  const totalDraws = draws.length;

  const soloMap = new Map();
  const fullMap = new Map();

  function soloKey(d) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].slice().sort((a,b)=>a-b);
    return nums.join('-');
  }
  function fullKey(d) {
    return soloKey(d) + '|' + d.super_balota;
  }

  for (const d of draws) {
    const s = soloKey(d);
    const f = fullKey(d);

    if (!soloMap.has(s)) soloMap.set(s, {count:0, items:[]});
    if (!fullMap.has(f)) fullMap.set(f, {count:0, items:[]});
    soloMap.get(s).count++;
    soloMap.get(s).items.push(d);
    fullMap.get(f).count++;
    fullMap.get(f).items.push(d);
  }

  const repeatedSolo = Array.from(soloMap.entries()).filter(([,v])=>v.count>1).map(([k,v])=>({combo:k,count:v.count, dates:v.items.map(x=>x.fecha_sorteo)}));
  const repeatedFull = Array.from(fullMap.entries()).filter(([,v])=>v.count>1).map(([k,v])=>({combo:k,count:v.count, dates:v.items.map(x=>x.fecha_sorteo)}));

  // per-year totals and per-year counts of draws that are part of a repeated solo combo
  const perYear = {};
  for (let y=fromYear;y<=toYear;y++) perYear[y] = {draws:0, repeats_in_draws:0};
  for (const d of draws) {
    const y = yearOf(d.fecha_sorteo);
    perYear[y].draws++;
    if (soloMap.get(soloKey(d)).count > 1) perYear[y].repeats_in_draws++;
  }

  const M = nCr(43,5); // unordered choices for main 5
  const M_full = M * 16; // with super (assuming 1..16)
  const expectedDuplicates = (totalDraws*(totalDraws-1))/(2*M);
  const probAtLeastOne = 1 - Math.exp(- (totalDraws*(totalDraws-1))/(2*M));
  const probAtLeastOneFull = 1 - Math.exp(- (totalDraws*(totalDraws-1))/(2*M_full));

  // Calcular combinaciones restantes
  const combinacionesUsadas = soloMap.size;
  const combinacionesRestantes = M - combinacionesUsadas;
  const porcentajeUsado = ((combinacionesUsadas / M) * 100).toFixed(4);
  const porcentajeRestante = ((combinacionesRestantes / M) * 100).toFixed(4);

  const readmeLines = [];
  readmeLines.push('**Resumen Estadístico 2021–2026**');
  readmeLines.push('');
  readmeLines.push('- **Periodo:** 2021 a 2026 inclusive.');
  readmeLines.push(`- **Total de sorteos en el periodo:** ${totalDraws}`);
  readmeLines.push('');
  readmeLines.push('**Repeticiones (ignorando \"super_balota\")**:');
  readmeLines.push(`- **Combinaciones únicas (orden-insensible):** ${soloMap.size}`);
  readmeLines.push(`- **Combinaciones que se repitieron (count>1):** ${repeatedSolo.length}`);
  const totalRepeatedDraws = repeatedSolo.reduce((s,e)=>s + e.count, 0);
  readmeLines.push(`- **Total de sorteos que forman parte de alguna repetición (ignorando super):** ${totalRepeatedDraws}`);
  readmeLines.push('');
  readmeLines.push('**Repeticiones exactas (incluyendo super_balota)**:');
  readmeLines.push(`- **Combinaciones exactas (incluyendo super) que se repitieron:** ${repeatedFull.length}`);
  const totalRepeatedFullDraws = repeatedFull.reduce((s,e)=>s + e.count, 0);
  readmeLines.push(`- **Total de sorteos que forman parte de repetición exacta:** ${totalRepeatedFullDraws}`);
  readmeLines.push('');
  readmeLines.push('**Combinaciones disponibles y usadas**:');
  readmeLines.push(`- **Total de combinaciones posibles (5 sin orden) M = C(43,5):** ${M.toLocaleString()}`);
  readmeLines.push(`- **Combinaciones que YA han salido:** ${combinacionesUsadas.toLocaleString()} (${porcentajeUsado}%)`);
  readmeLines.push(`- **Combinaciones que AÚN NO han salido (restantes):** ${combinacionesRestantes.toLocaleString()} (${porcentajeRestante}%)`);
  readmeLines.push('');
  readmeLines.push('**Tasa empírica y probabilidades teóricas**:');
  readmeLines.push(`- **Número de posibles combinaciones (5 sin orden) M = C(43,5):** ${M}`);
  readmeLines.push(`- **Probabilidad de repetir exactamente la misma 5-tupla (ignorando super) en un sorteo dado:** 1/${M} ≈ ${ (1/M).toExponential(3) }`);
  readmeLines.push(`- **Probabilidad de repetir exactamente la misma combinación incluyendo super (suponiendo 16 posibles):** 1/${M_full} ≈ ${ (1/M_full).toExponential(3) }`);
  readmeLines.push(`- **Probabilidad aproximada de al menos una repetición (ignorando super) entre ${totalDraws} sorteos (modelo aleatorio):** ${probAtLeastOne.toFixed(6)} (≈ ${ (probAtLeastOne*100).toFixed(4) }%)`);
  readmeLines.push(`- **Probabilidad aproximada de al menos una repetición exacta (incluyendo super):** ${probAtLeastOneFull.toFixed(6)} (≈ ${ (probAtLeastOneFull*100).toFixed(6) }%)`);
  readmeLines.push('');
  readmeLines.push('**Desglose por año**:');
  for (let y=fromYear;y<=toYear;y++) {
    readmeLines.push(`- **${y}**: sorteos=${perYear[y].draws}, sorteos en combinaciones repetidas=${perYear[y].repeats_in_draws}`);
  }
  readmeLines.push('');
  readmeLines.push('**Top combinaciones repetidas (ignorando super) — top 10 por ocurrencias**:');
  const topSolo = repeatedSolo.sort((a,b)=>b.count-a.count).slice(0,10);
  for (const r of topSolo) {
    readmeLines.push(`- ${r.combo} → ${r.count} veces — fechas: ${[...new Set(r.dates)].slice(0,6).join(', ')}${r.dates.length>6?', ...':''}`);
  }
  readmeLines.push('');
  readmeLines.push('**Top combinaciones exactas (incluyendo super) — top 10**:');
  const topFull = repeatedFull.sort((a,b)=>b.count-a.count).slice(0,10);
  for (const r of topFull) {
    readmeLines.push(`- ${r.combo} → ${r.count} veces — fechas: ${[...new Set(r.dates)].slice(0,6).join(', ')}${r.dates.length>6?', ...':''}`);
  }
  readmeLines.push('');
  readmeLines.push('**Método**:');
  readmeLines.push('- Repetición (ignorando super): se genera una firma ordenada con las 5 balotas principales y se cuentan repeticiones de esa firma.');
  readmeLines.push('- Repetición exacta: firma que incluye las 5 balotas ordenadas y el valor de `super_balota`.');
  readmeLines.push('');
  readmeLines.push('**Conclusiones rápidas**:');
  readmeLines.push(`- Durante ${fromYear}-${toYear} hay ${repeatedSolo.length} combinaciones (orden-insensible) que se repitieron al menos una vez.`);
  readmeLines.push(`- El modelo aleatorio sugiere que la probabilidad de observar al menos una repetición (ignorando super) con ${totalDraws} sorteos es ≈ ${(probAtLeastOne*100).toFixed(4)}% — es baja pero no nula.`);
  readmeLines.push('');
  fs.writeFileSync(README_FILE, readmeLines.join('\n'));
  console.log('Análisis completado. README.md generado.');
}

analyze();
