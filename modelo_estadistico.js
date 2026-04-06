/**
 * MODELO ESTADÍSTICO DE BALOTAS
 * Análisis de patrones, probabilidad ponderada y generación de combinaciones
 * Usa: frecuencia histórica + recencia + z-scores + análisis de pares + estructura
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'balotas.json');
const REPORT_FILE = path.join(__dirname, 'reporte_visual.html');

// ─── CARGA DE DATOS ───────────────────────────────────────────────────────────
function loadDraws() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const all = JSON.parse(raw);
  return all
    .filter(d => {
      const y = new Date(d.fecha_sorteo).getFullYear();
      return y >= 2021 && y <= 2026;
    })
    .sort((a, b) => new Date(b.fecha_sorteo) - new Date(a.fecha_sorteo)); // más reciente primero
}

// ─── FRECUENCIA ───────────────────────────────────────────────────────────────
function calcFrequency(draws) {
  const freq = {};
  for (let i = 1; i <= 43; i++) freq[i] = 0;
  for (const d of draws) {
    [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].forEach(n => freq[n]++);
  }
  return freq;
}

// ─── ESTADÍSTICAS (media, varianza, desviación estándar) ─────────────────────
function calcStats(freq) {
  const values = Object.values(freq);
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const median = values.slice().sort((a, b) => a - b)[Math.floor(n / 2)];
  return { mean, std, variance, median };
}

// ─── Z-SCORES (cuántas desviaciones sobre/bajo la media) ─────────────────────
function calcZScores(freq, mean, std) {
  const z = {};
  for (const [k, v] of Object.entries(freq)) {
    z[Number(k)] = (v - mean) / std;
  }
  return z;
}

// ─── FRECUENCIA DE PARES (co-ocurrencia) ─────────────────────────────────────
function calcPairFreq(draws) {
  const pairs = {};
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].sort((a, b) => a - b);
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const k = nums[i] + '-' + nums[j];
        pairs[k] = (pairs[k] || 0) + 1;
      }
    }
  }
  return pairs;
}

// ─── ESTADÍSTICAS DE SUMA ─────────────────────────────────────────────────────
function calcSumStats(draws) {
  const sums = draws.map(d => d.balota_1 + d.balota_2 + d.balota_3 + d.balota_4 + d.balota_5);
  const n = sums.length;
  const mean = sums.reduce((a, b) => a + b, 0) / n;
  const variance = sums.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
  const std = Math.sqrt(variance);
  const sorted = sums.slice().sort((a, b) => a - b);
  return {
    sums,
    mean,
    std,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(n / 2)],
    // Rango estadístico: media ± 1.5 SD cubre ~87% de los sorteos
    rangeLow: Math.max(15, Math.round(mean - 1.5 * std)),
    rangeHigh: Math.min(200, Math.round(mean + 1.5 * std))
  };
}

// ─── DISTRIBUCIONES ───────────────────────────────────────────────────────────
function calcParityDist(draws) {
  const dist = {};
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5];
    const even = nums.filter(n => n % 2 === 0).length;
    const key = even + 'P-' + (5 - even) + 'I';
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}

function calcRangeDist(draws) {
  const dist = {};
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5];
    const bajo = nums.filter(n => n <= 14).length;
    const medio = nums.filter(n => n >= 15 && n <= 29).length;
    const alto = nums.filter(n => n >= 30).length;
    const key = bajo + '-' + medio + '-' + alto;
    dist[key] = (dist[key] || 0) + 1;
  }
  return dist;
}

function calcSuperFreq(draws) {
  const freq = {};
  for (let i = 1; i <= 16; i++) freq[i] = 0;
  for (const d of draws) {
    const s = Number(d.super_balota);
    if (s >= 1 && s <= 16) freq[s]++;
  }
  return freq;
}

// ─── PROBABILIDAD PONDERADA (histórico + reciente) ───────────────────────────
// La clave: números que aparecen frecuentemente EN GENERAL y también RECIENTEMENTE
// reciben mayor peso. Esto combina la Ley de Grandes Números con señales de tendencia.
function buildWeightedProb(histFreq, recentFreq, totalDraws, recentCount) {
  const prob = {};
  const histTotal = totalDraws * 5;
  const recentTotal = recentCount * 5;

  for (let i = 1; i <= 43; i++) {
    const histNorm = histFreq[i] / histTotal;       // probabilidad histórica
    const recentNorm = recentFreq[i] / recentTotal;  // probabilidad reciente
    // Peso: 55% histórico (más datos = más confiable) + 45% reciente (tendencia)
    prob[i] = 0.55 * histNorm + 0.45 * recentNorm;
  }

  // Normalizar a suma = 1
  const total = Object.values(prob).reduce((a, b) => a + b, 0);
  for (let i = 1; i <= 43; i++) prob[i] /= total;
  return prob;
}

// ─── SELECCIÓN PONDERADA SIN REEMPLAZO ───────────────────────────────────────
function weightedSampleUnique(prob, count) {
  const remaining = Array.from({ length: 43 }, (_, i) => i + 1);
  const weights = remaining.map(n => prob[n]);
  const selected = [];

  while (selected.length < count) {
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let idx = 0;
    while (idx < weights.length - 1 && r > weights[idx]) {
      r -= weights[idx];
      idx++;
    }
    selected.push(remaining[idx]);
    remaining.splice(idx, 1);
    weights.splice(idx, 1);
  }

  return selected.sort((a, b) => a - b);
}

// ─── PUNTUACIÓN DE COMBINACIÓN ────────────────────────────────────────────────
// Cada combinación se puntúa con múltiples criterios estadísticos
function scoreCombo(combo, zScores, recentFreq, pairFreq, sumStats, parityDist, rangeDist, totalDraws) {
  const sum = combo.reduce((a, b) => a + b, 0);
  const evenCount = combo.filter(n => n % 2 === 0).length;
  const bajo = combo.filter(n => n <= 14).length;
  const medio = combo.filter(n => n >= 15 && n <= 29).length;
  const alto = combo.filter(n => n >= 30).length;

  // 1. Suma de z-scores (números estadísticamente más frecuentes = mayor puntaje)
  const zSum = combo.reduce((s, n) => s + zScores[n], 0);

  // 2. Frecuencia reciente ponderada
  const recentScore = combo.reduce((s, n) => s + recentFreq[n], 0);

  // 3. Ajuste estructural: suma dentro del rango estadístico ±1.5 SD
  const sumFit = (sum >= sumStats.rangeLow && sum <= sumStats.rangeHigh) ? 12 : 0;

  // 4. Paridad: basada en la distribución histórica real
  const parityKey = evenCount + 'P-' + (5 - evenCount) + 'I';
  const parityFreq = parityDist[parityKey] || 0;
  const parityFit = (parityFreq / totalDraws) * 20; // peso proporcional a su frecuencia histórica

  // 5. Distribución de rangos: basada en distribución histórica real
  const rangeKey = bajo + '-' + medio + '-' + alto;
  const rangeFreqVal = rangeDist[rangeKey] || 0;
  const rangeFit = (rangeFreqVal / totalDraws) * 15;

  // 6. Bonus por pares co-ocurrentes (pares que históricamente salen juntos)
  let pairBonus = 0;
  const sorted = combo.slice().sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const k = sorted[i] + '-' + sorted[j];
      if (pairFreq[k]) pairBonus += pairFreq[k] * 0.25;
    }
  }

  const totalScore = zSum * 4 + recentScore * 0.9 + sumFit + parityFit + rangeFit + pairBonus;

  return { sum, evenCount, bajo, medio, alto, zSum: parseFloat(zSum.toFixed(3)), recentScore, sumFit, parityFit: parseFloat(parityFit.toFixed(2)), rangeFit: parseFloat(rangeFit.toFixed(2)), pairBonus: parseFloat(pairBonus.toFixed(2)), totalScore: parseFloat(totalScore.toFixed(2)) };
}

// ─── GENERACIÓN DE COMBINACIONES ─────────────────────────────────────────────
function generateCombinations(prob, zScores, recentFreq, pairFreq, sumStats, parityDist, rangeDist, totalDraws, count) {
  const candidates = [];
  const seen = new Set();
  let attempts = 0;

  while (candidates.length < count * 15 && attempts < 80000) {
    attempts++;
    const combo = weightedSampleUnique(prob, 5);
    const key = combo.join(',');
    if (seen.has(key)) continue;
    seen.add(key);

    const score = scoreCombo(combo, zScores, recentFreq, pairFreq, sumStats, parityDist, rangeDist, totalDraws);
    candidates.push({ combo, ...score });
  }

  candidates.sort((a, b) => b.totalScore - a.totalScore);

  // Diversificar: no permitir que las top N sean demasiado parecidas
  const diversified = [];
  for (const c of candidates) {
    if (diversified.length >= count) break;
    // Verificar que tenga al menos 2 números distintos de las ya elegidas
    let tooSimilar = false;
    for (const chosen of diversified) {
      const shared = c.combo.filter(n => chosen.combo.includes(n)).length;
      if (shared >= 4) { tooSimilar = true; break; }
    }
    if (!tooSimilar) diversified.push(c);
  }

  // Si no alcanzamos el count, llenar con los mejores restantes
  for (const c of candidates) {
    if (diversified.length >= count) break;
    if (!diversified.find(d => d.combo.join(',') === c.combo.join(','))) {
      diversified.push(c);
    }
  }

  return diversified.slice(0, count);
}

// ─── HISTOGRAMA DE SUMAS ──────────────────────────────────────────────────────
function buildSumHistogram(sums) {
  const buckets = {};
  for (const s of sums) {
    const bucket = Math.floor(s / 5) * 5;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  return buckets;
}

// ─── SALIDA EN CONSOLA ────────────────────────────────────────────────────────
function printResults(totalDraws, histStats, zScores, sumStats, parityDist, rangeDist, topPairs, top10) {
  const line = '═'.repeat(65);
  const dash = '─'.repeat(65);

  console.log('\n' + line);
  console.log('  MODELO ESTADÍSTICO DE BALOTAS — ANÁLISIS COMPLETO');
  console.log(line);
  console.log('\n  Sorteos analizados: ' + totalDraws + ' (2021-2026)');

  console.log('\n  FRECUENCIA DE NÚMEROS (1-43):');
  console.log('  Media (mu):            ' + histStats.mean.toFixed(2) + ' apariciones');
  console.log('  Desviación std (sigma): ' + histStats.std.toFixed(2));
  console.log('  Mediana:               ' + histStats.median.toFixed(0));
  console.log('  Varianza:              ' + histStats.variance.toFixed(2));

  const hotNums = Object.entries(zScores)
    .filter(([, z]) => z > 0.8)
    .sort((a, b) => b[1] - a[1])
    .map(([n, z]) => n + '(z=' + z.toFixed(1) + ')');

  const coldNums = Object.entries(zScores)
    .filter(([, z]) => z < -0.8)
    .sort((a, b) => a[1] - b[1])
    .map(([n, z]) => n + '(z=' + z.toFixed(1) + ')');

  console.log('\n  CALIENTES (z > +0.8): ' + (hotNums.join(', ') || 'ninguno'));
  console.log('  FRIOS    (z < -0.8): ' + (coldNums.join(', ') || 'ninguno'));

  console.log('\n  ESTADÍSTICAS DE SUMA:');
  console.log('  Min: ' + sumStats.min + '  |  Max: ' + sumStats.max + '  |  Media: ' + sumStats.mean.toFixed(1) + '  |  SD: ' + sumStats.std.toFixed(1));
  console.log('  Rango optimo (media ± 1.5 SD): [' + sumStats.rangeLow + ', ' + sumStats.rangeHigh + ']');

  console.log('\n  PARIDAD MAS COMUN:');
  Object.entries(parityDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .forEach(([k, v]) => {
      const pct = ((v / totalDraws) * 100).toFixed(1);
      console.log('    ' + k + ': ' + v + ' sorteos (' + pct + '%)');
    });

  console.log('\n  DISTRIBUCION DE RANGOS (Bajo 1-14 / Medio 15-29 / Alto 30-43):');
  Object.entries(rangeDist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([k, v]) => {
      const pct = ((v / totalDraws) * 100).toFixed(1);
      console.log('    B-M-A = ' + k + ': ' + v + ' sorteos (' + pct + '%)');
    });

  console.log('\n  TOP 10 PARES CO-OCURRENTES:');
  topPairs.slice(0, 10).forEach(([pair, count]) => {
    const pct = ((count / totalDraws) * 100).toFixed(1);
    console.log('    ' + pair + ' -> ' + count + ' veces (' + pct + '%)');
  });

  console.log('\n' + dash);
  console.log('  TOP 10 COMBINACIONES RECOMENDADAS:');
  console.log(dash);
  console.log('  #  | Combinacion            | Suma | Paridad | Rango   | Score');
  console.log('  ---|------------------------|------|---------|---------|------');
  top10.forEach((c, i) => {
    const tag = i === 0 ? ' <-- MEJOR' : '';
    const num = String(i + 1).padStart(2);
    const combo = c.combo.join(' - ').padEnd(22);
    const sum = String(c.sum).padStart(3);
    const parity = (c.evenCount + 'P/' + (5 - c.evenCount) + 'I').padEnd(7);
    const range = (c.bajo + '-' + c.medio + '-' + c.alto).padEnd(7);
    const score = c.totalScore.toFixed(1);
    console.log('  ' + num + ' | ' + combo + ' | ' + sum + '  | ' + parity + ' | ' + range + ' | ' + score + tag);
  });

  console.log('\n' + line);
  console.log('  REPORTE VISUAL: ' + REPORT_FILE);
  console.log('  Abre reporte_visual.html en tu navegador para ver las graficas.');
  console.log(line + '\n');
}

// ─── GENERACIÓN DEL REPORTE HTML ──────────────────────────────────────────────
function generateHTMLReport(data) {
  const {
    totalDraws, freq, recentFreq, zScores, histStats,
    pairFreq, topPairs, sumStats, sumBuckets,
    parityDist, rangeDist, superFreq, top10
  } = data;

  const labels = Array.from({ length: 43 }, (_, i) => i + 1);
  const freqData = labels.map(n => freq[n]);
  const recentData = labels.map(n => recentFreq[n]);
  const zData = labels.map(n => parseFloat(zScores[n].toFixed(3)));

  // Colores según z-score
  const freqColors = labels.map(n => {
    const z = zScores[n];
    if (z > 1.5) return 'rgba(220,38,38,0.85)';
    if (z > 0.8) return 'rgba(245,158,11,0.85)';
    if (z > 0) return 'rgba(16,185,129,0.7)';
    if (z > -0.8) return 'rgba(107,114,128,0.7)';
    if (z > -1.5) return 'rgba(99,202,235,0.8)';
    return 'rgba(29,78,216,0.85)';
  });

  const zColors = zData.map(z => {
    if (z > 1.5) return 'rgba(220,38,38,0.9)';
    if (z > 0.5) return 'rgba(245,158,11,0.9)';
    if (z < -1.5) return 'rgba(29,78,216,0.9)';
    if (z < -0.5) return 'rgba(99,202,235,0.9)';
    return 'rgba(107,114,128,0.8)';
  });

  const parityLabels = Object.keys(parityDist).sort();
  const parityValues = parityLabels.map(k => parityDist[k]);

  const sumKeys = Object.keys(sumBuckets).map(Number).sort((a, b) => a - b);
  const sumVals = sumKeys.map(k => sumBuckets[k]);
  const sumColors = sumKeys.map(k => {
    if (k >= sumStats.rangeLow && k <= sumStats.rangeHigh) return 'rgba(16,185,129,0.85)';
    return 'rgba(107,114,128,0.6)';
  });

  // Tabla de top 10
  const comboRows = top10.map((c, i) => {
    const bg = i === 0 ? 'background:#1a3a1a;' : '';
    const numBalls = c.combo.map(n => {
      const z = zScores[n];
      let cls = 'num-normal';
      if (z > 0.8) cls = 'num-hot';
      else if (z < -0.8) cls = 'num-cold';
      return '<span class="ball ' + cls + '">' + n + '</span>';
    }).join('');
    return '<tr style="' + bg + '">' +
      '<td>' + (i + 1) + (i === 0 ? ' ⭐' : '') + '</td>' +
      '<td style="display:flex;gap:4px;flex-wrap:wrap">' + numBalls + '</td>' +
      '<td>' + c.sum + '</td>' +
      '<td>' + c.evenCount + 'P / ' + (5 - c.evenCount) + 'I</td>' +
      '<td>' + c.bajo + '-' + c.medio + '-' + c.alto + '</td>' +
      '<td>' + c.zSum.toFixed(2) + '</td>' +
      '<td><strong>' + c.totalScore.toFixed(1) + '</strong></td>' +
    '</tr>';
  }).join('');

  // Tabla de frecuencia por número
  const freqTableRows = labels.map(n => {
    const z = zScores[n];
    let cls = '';
    let tag = '';
    if (z > 1.5) { cls = 'color:#dc2626'; tag = 'Muy caliente'; }
    else if (z > 0.8) { cls = 'color:#f59e0b'; tag = 'Caliente'; }
    else if (z < -1.5) { cls = 'color:#3b82f6'; tag = 'Muy frio'; }
    else if (z < -0.8) { cls = 'color:#63caeb'; tag = 'Frio'; }
    else { cls = 'color:#94a3b8'; tag = 'Normal'; }
    const pct = ((freq[n] / (totalDraws * 5)) * 100).toFixed(2);
    return '<tr>' +
      '<td style="font-weight:bold;' + cls + '">' + n + '</td>' +
      '<td>' + freq[n] + '</td>' +
      '<td>' + recentFreq[n] + '</td>' +
      '<td>' + pct + '%</td>' +
      '<td>' + zScores[n].toFixed(3) + '</td>' +
      '<td style="' + cls + '">' + tag + '</td>' +
    '</tr>';
  }).join('');

  // Super balota
  const superLabels = Array.from({ length: 16 }, (_, i) => i + 1);
  const superData = superLabels.map(n => superFreq[n] || 0);

  const html = '<!DOCTYPE html>\n<html lang="es">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>Analisis Estadistico de Balotas 2021-2026</title>\n' +
    '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>\n' +
    '<style>\n' +
    '* { box-sizing: border-box; margin: 0; padding: 0; }\n' +
    'body { font-family: "Segoe UI", Arial, sans-serif; background: #0f172a; color: #e2e8f0; }\n' +
    '.header { background: linear-gradient(135deg, #1e3a5f 0%, #2d1b69 100%); padding: 2rem; text-align: center; border-bottom: 2px solid #334155; }\n' +
    '.header h1 { font-size: 1.9rem; color: #60a5fa; margin-bottom: 0.4rem; }\n' +
    '.header p { color: #94a3b8; font-size: 0.95rem; }\n' +
    '.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; padding: 1.5rem 2rem; }\n' +
    '.stat-card { background: #1e293b; border-radius: 10px; padding: 1.2rem; text-align: center; border: 1px solid #334155; }\n' +
    '.stat-card .value { font-size: 1.8rem; font-weight: bold; color: #60a5fa; }\n' +
    '.stat-card .label { color: #94a3b8; font-size: 0.8rem; margin-top: 0.3rem; }\n' +
    '.section { padding: 0.5rem 2rem 1.5rem 2rem; }\n' +
    '.section h2 { color: #60a5fa; margin-bottom: 1rem; margin-top: 0.5rem; font-size: 1.15rem; border-left: 4px solid #60a5fa; padding-left: 0.8rem; }\n' +
    '.chart-box { background: #1e293b; border-radius: 10px; padding: 1.2rem; border: 1px solid #334155; }\n' +
    '.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }\n' +
    '.chart-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }\n' +
    '.h350 { height: 350px; }\n' +
    '.h280 { height: 280px; }\n' +
    '.h220 { height: 220px; }\n' +
    'table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }\n' +
    'th { background: #1e40af; color: white; padding: 0.6rem 0.8rem; text-align: left; }\n' +
    'td { padding: 0.5rem 0.8rem; border-bottom: 1px solid #1e293b; }\n' +
    'tr:hover td { background: #1a2744; }\n' +
    '.ball { border-radius: 50%; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.82rem; }\n' +
    '.num-hot { background: #dc2626; color: white; }\n' +
    '.num-cold { background: #1d4ed8; color: white; }\n' +
    '.num-normal { background: #334155; color: #e2e8f0; }\n' +
    '.legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.8rem; font-size: 0.82rem; color: #94a3b8; }\n' +
    '.leg { display: inline-flex; align-items: center; gap: 0.3rem; }\n' +
    '.dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }\n' +
    '.footer { text-align: center; padding: 2rem; color: #475569; font-size: 0.82rem; border-top: 1px solid #1e293b; margin-top: 2rem; }\n' +
    '@media (max-width: 900px) { .stats-grid { grid-template-columns: repeat(3, 1fr); } .chart-row, .chart-row3 { grid-template-columns: 1fr; } }\n' +
    '</style>\n</head>\n<body>\n' +

    '<div class="header">\n' +
    '<h1>Analisis Estadistico de Balotas</h1>\n' +
    '<p>Modelo de probabilidad ponderada — Datos historicos 2021-2026 | Generado: ' + new Date().toLocaleDateString('es-CO') + '</p>\n' +
    '</div>\n\n' +

    '<div class="stats-grid">\n' +
    '<div class="stat-card"><div class="value">' + totalDraws + '</div><div class="label">Sorteos analizados</div></div>\n' +
    '<div class="stat-card"><div class="value">' + histStats.mean.toFixed(1) + '</div><div class="label">Frecuencia media</div></div>\n' +
    '<div class="stat-card"><div class="value">±' + histStats.std.toFixed(2) + '</div><div class="label">Desviacion estandar</div></div>\n' +
    '<div class="stat-card"><div class="value">' + sumStats.mean.toFixed(0) + '</div><div class="label">Suma promedio</div></div>\n' +
    '<div class="stat-card"><div class="value">' + sumStats.rangeLow + '-' + sumStats.rangeHigh + '</div><div class="label">Rango optimo de suma</div></div>\n' +
    '</div>\n\n' +

    '<div class="section">\n' +
    '<h2>Frecuencia Historica — Todos los numeros 1 a 43</h2>\n' +
    '<div class="chart-box"><canvas id="freqChart" class="h350"></canvas>\n' +
    '<div class="legend">' +
    '<span class="leg"><span class="dot" style="background:#dc2626"></span>Muy caliente (z &gt; 1.5)</span>' +
    '<span class="leg"><span class="dot" style="background:#f59e0b"></span>Caliente (z &gt; 0.8)</span>' +
    '<span class="leg"><span class="dot" style="background:#10b981"></span>Ligeramente caliente</span>' +
    '<span class="leg"><span class="dot" style="background:#6b7280"></span>Normal</span>' +
    '<span class="leg"><span class="dot" style="background:#63caeb"></span>Frio</span>' +
    '<span class="leg"><span class="dot" style="background:#1d4ed8"></span>Muy frio (z &lt; -1.5)</span>' +
    '</div></div>\n</div>\n\n' +

    '<div class="section">\n' +
    '<div class="chart-row">\n' +
    '<div><h2>Z-Scores (Desviaciones de la Media)</h2><div class="chart-box"><canvas id="zChart" class="h280"></canvas></div></div>\n' +
    '<div><h2>Frecuencia Reciente (Ultimos 30 sorteos)</h2><div class="chart-box"><canvas id="recentChart" class="h280"></canvas></div></div>\n' +
    '</div>\n</div>\n\n' +

    '<div class="section">\n' +
    '<div class="chart-row3">\n' +
    '<div><h2>Distribucion de Paridad</h2><div class="chart-box"><canvas id="parityChart" class="h220"></canvas></div></div>\n' +
    '<div><h2>Histograma de Sumas</h2><div class="chart-box"><canvas id="sumChart" class="h220"></canvas></div></div>\n' +
    '<div><h2>Super Balota (Frecuencia)</h2><div class="chart-box"><canvas id="superChart" class="h220"></canvas></div></div>\n' +
    '</div>\n</div>\n\n' +

    '<div class="section">\n' +
    '<h2>Top 10 Combinaciones Recomendadas</h2>\n' +
    '<div class="chart-box">\n' +
    '<table><thead><tr><th>#</th><th>Combinacion</th><th>Suma</th><th>Paridad</th><th>B-M-A</th><th>Z-Score</th><th>Score</th></tr></thead>\n' +
    '<tbody>' + comboRows + '</tbody></table>\n' +
    '<div class="legend" style="margin-top:1rem">' +
    '<span class="leg"><span class="ball num-hot" style="width:18px;height:18px;font-size:0.7rem">n</span>Numero caliente (z &gt; 0.8)</span>' +
    '<span class="leg"><span class="ball num-cold" style="width:18px;height:18px;font-size:0.7rem">n</span>Numero frio (z &lt; -0.8)</span>' +
    '<span class="leg"><span class="ball num-normal" style="width:18px;height:18px;font-size:0.7rem">n</span>Normal</span>' +
    '</div>\n</div>\n</div>\n\n' +

    '<div class="section">\n' +
    '<h2>Tabla Completa de Frecuencias por Numero</h2>\n' +
    '<div class="chart-box">\n' +
    '<table><thead><tr><th>N</th><th>Frec. Historica</th><th>Frec. Reciente</th><th>Probabilidad</th><th>Z-Score</th><th>Estado</th></tr></thead>\n' +
    '<tbody>' + freqTableRows + '</tbody></table>\n' +
    '</div>\n</div>\n\n' +

    '<div class="footer">' +
    '<p>Analisis estadistico para proyecto estudiantil | Los sorteos de loteria son aleatorios por naturaleza.</p>' +
    '<p style="margin-top:0.4rem">Metodo: Frecuencia historica ponderada (55%) + Tendencia reciente (45%) + Analisis de z-scores + Co-ocurrencia de pares</p>' +
    '</div>\n\n' +

    '<script>\n' +
    'var LABELS = ' + JSON.stringify(labels) + ';\n' +
    'var FREQ_DATA = ' + JSON.stringify(freqData) + ';\n' +
    'var FREQ_COLORS = ' + JSON.stringify(freqColors) + ';\n' +
    'var RECENT_DATA = ' + JSON.stringify(recentData) + ';\n' +
    'var Z_DATA = ' + JSON.stringify(zData) + ';\n' +
    'var Z_COLORS = ' + JSON.stringify(zColors) + ';\n' +
    'var PARITY_LABELS = ' + JSON.stringify(parityLabels) + ';\n' +
    'var PARITY_VALUES = ' + JSON.stringify(parityValues) + ';\n' +
    'var SUM_KEYS = ' + JSON.stringify(sumKeys) + ';\n' +
    'var SUM_VALS = ' + JSON.stringify(sumVals) + ';\n' +
    'var SUM_COLORS = ' + JSON.stringify(sumColors) + ';\n' +
    'var SUPER_LABELS = ' + JSON.stringify(superLabels) + ';\n' +
    'var SUPER_DATA = ' + JSON.stringify(superData) + ';\n' +
    'var MEAN_LINE = ' + histStats.mean.toFixed(2) + ';\n' +
    'var SUM_RANGE_LOW = ' + sumStats.rangeLow + ';\n' +
    'var SUM_RANGE_HIGH = ' + sumStats.rangeHigh + ';\n\n' +
    'var darkGrid = "#334155";\n' +
    'var darkTick = { color: "#94a3b8" };\n' +
    'var darkLegend = { labels: { color: "#e2e8f0" } };\n\n' +

    '// 1. Frecuencia historica\n' +
    'new Chart(document.getElementById("freqChart"), {\n' +
    '  type: "bar",\n' +
    '  data: {\n' +
    '    labels: LABELS,\n' +
    '    datasets: [\n' +
    '      { label: "Frecuencia historica", data: FREQ_DATA, backgroundColor: FREQ_COLORS, borderWidth: 0 },\n' +
    '      { label: "Media (" + MEAN_LINE + ")", data: Array(43).fill(MEAN_LINE), type: "line", borderColor: "rgba(255,255,255,0.5)", borderWidth: 1.5, pointRadius: 0, borderDash: [4,4] }\n' +
    '    ]\n' +
    '  },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: darkLegend }, scales: { x: { ticks: darkTick, grid: { color: darkGrid } }, y: { ticks: darkTick, grid: { color: darkGrid } } } }\n' +
    '});\n\n' +

    '// 2. Z-scores\n' +
    'new Chart(document.getElementById("zChart"), {\n' +
    '  type: "bar",\n' +
    '  data: { labels: LABELS, datasets: [{ label: "Z-Score", data: Z_DATA, backgroundColor: Z_COLORS, borderWidth: 0 }] },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {\n' +
    '    x: { ticks: { ...darkTick, maxTicksLimit: 22 }, grid: { color: darkGrid } },\n' +
    '    y: { ticks: darkTick, grid: { color: darkGrid } }\n' +
    '  }}\n' +
    '});\n\n' +

    '// 3. Frecuencia reciente\n' +
    'var recentColors = RECENT_DATA.map(function(v, i) { return Z_DATA[i] > 0.5 ? "rgba(245,158,11,0.85)" : Z_DATA[i] < -0.5 ? "rgba(99,202,235,0.85)" : "rgba(107,114,128,0.75)"; });\n' +
    'new Chart(document.getElementById("recentChart"), {\n' +
    '  type: "bar",\n' +
    '  data: { labels: LABELS, datasets: [{ label: "Frecuencia reciente", data: RECENT_DATA, backgroundColor: recentColors, borderWidth: 0 }] },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {\n' +
    '    x: { ticks: { ...darkTick, maxTicksLimit: 22 }, grid: { color: darkGrid } },\n' +
    '    y: { ticks: darkTick, grid: { color: darkGrid } }\n' +
    '  }}\n' +
    '});\n\n' +

    '// 4. Paridad\n' +
    'new Chart(document.getElementById("parityChart"), {\n' +
    '  type: "doughnut",\n' +
    '  data: { labels: PARITY_LABELS, datasets: [{ data: PARITY_VALUES, backgroundColor: ["#dc2626","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"] }] },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: darkLegend } }\n' +
    '});\n\n' +

    '// 5. Histograma de sumas\n' +
    'new Chart(document.getElementById("sumChart"), {\n' +
    '  type: "bar",\n' +
    '  data: { labels: SUM_KEYS.map(function(k) { return k + "-" + (k+4); }), datasets: [{ label: "Sorteos", data: SUM_VALS, backgroundColor: SUM_COLORS, borderWidth: 0 }] },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {\n' +
    '    x: { ticks: { ...darkTick, maxRotation: 45 }, grid: { color: darkGrid } },\n' +
    '    y: { ticks: darkTick, grid: { color: darkGrid } }\n' +
    '  }}\n' +
    '});\n\n' +

    '// 6. Super balota\n' +
    'var superColors = SUPER_DATA.map(function(v) { var max = Math.max.apply(null, SUPER_DATA); return v === max ? "rgba(220,38,38,0.85)" : "rgba(59,130,246,0.75)"; });\n' +
    'new Chart(document.getElementById("superChart"), {\n' +
    '  type: "bar",\n' +
    '  data: { labels: SUPER_LABELS, datasets: [{ label: "Super Balota", data: SUPER_DATA, backgroundColor: superColors, borderWidth: 0 }] },\n' +
    '  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: {\n' +
    '    x: { ticks: darkTick, grid: { color: darkGrid } },\n' +
    '    y: { ticks: darkTick, grid: { color: darkGrid } }\n' +
    '  }}\n' +
    '});\n' +
    '<\/script>\n</body>\n</html>';

  fs.writeFileSync(REPORT_FILE, html, 'utf8');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
  const draws = loadDraws();
  const totalDraws = draws.length;
  const recentDraws = draws.slice(0, 30); // últimos 30 sorteos

  // Estadísticas
  const freq = calcFrequency(draws);
  const recentFreq = calcFrequency(recentDraws);
  const histStats = calcStats(freq);
  const zScores = calcZScores(freq, histStats.mean, histStats.std);
  const pairFreq = calcPairFreq(draws);
  const sumStats = calcSumStats(draws);
  const parityDist = calcParityDist(draws);
  const rangeDist = calcRangeDist(draws);
  const superFreq = calcSuperFreq(draws);
  const sumBuckets = buildSumHistogram(sumStats.sums);

  const topPairs = Object.entries(pairFreq).sort((a, b) => b[1] - a[1]);

  // Probabilidad ponderada
  const prob = buildWeightedProb(freq, recentFreq, totalDraws, recentDraws.length);

  // Generar 10 combinaciones
  const top10 = generateCombinations(prob, zScores, recentFreq, pairFreq, sumStats, parityDist, rangeDist, totalDraws, 10);

  // Imprimir resultados
  printResults(totalDraws, histStats, zScores, sumStats, parityDist, rangeDist, topPairs, top10);

  // Generar HTML
  generateHTMLReport({
    totalDraws, freq, recentFreq, zScores, histStats,
    pairFreq, topPairs: topPairs.slice(0, 20),
    sumStats, sumBuckets, parityDist, rangeDist,
    superFreq, top10
  });
}

main();
