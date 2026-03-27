const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'balotas.json');
const NUM_BALLS = 43;
const PICK = 5;

// Números más frecuentes según análisis histórico
const NUMEROS_CALIENTES = [9, 5, 43, 32, 21, 33, 12, 26, 4, 42, 25, 39, 22, 13, 35];

// Pares que frecuentemente salen juntos
const PARES_CALIENTES = [
  [18, 40], [26, 27], [9, 21], [8, 30], [16, 26], [14, 28], [9, 39],
  [7, 33], [33, 43], [13, 43], [27, 42], [12, 32]
];

// Configuración de reglas basadas en análisis de patrones
const REGLAS = {
  maxConsecutivos: 2,  // máximo 2 números consecutivos (no toda la serie)
  minPares: 2,         // mínimo números pares
  maxPares: 3,         // máximo números pares
  sumaMin: 86,         // suma mínima de la combinación
  sumaMax: 136,        // suma máxima de la combinación
  distribucionRangos: true, // al menos 1 número de cada rango
};

function tupleKey(arr) {
  return arr.slice().sort((a,b)=>a-b).join(',');
}

// Verificar si TODA la combinación es consecutiva (1,2,3,4,5)
function isConsecutiveSorted(sortedArr) {
  for (let i = 0; i < sortedArr.length - 1; i++) {
    if (sortedArr[i+1] - sortedArr[i] !== 1) return false;
  }
  return true;
}

// Contar cuántos pares consecutivos hay
function countConsecutivePairs(sortedArr) {
  let count = 0;
  for (let i = 0; i < sortedArr.length - 1; i++) {
    if (sortedArr[i+1] - sortedArr[i] === 1) count++;
  }
  return count;
}

// Contar números pares
function countPares(arr) {
  return arr.filter(n => n % 2 === 0).length;
}

// Calcular suma
function suma(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// Verificar distribución de rangos (bajo: 1-14, medio: 15-29, alto: 30-43)
function hasBalancedRanges(arr) {
  const bajo = arr.filter(n => n <= 14).length;
  const medio = arr.filter(n => n >= 15 && n <= 29).length;
  const alto = arr.filter(n => n >= 30).length;
  // Al menos 1 de cada rango para mayor balance
  return bajo >= 1 && medio >= 1 && alto >= 1;
}

// Verificar si la combinación pasa todas las reglas
function passReglas(arr, applyRules = true) {
  if (!applyRules) return true;
  
  const sorted = arr.slice().sort((a, b) => a - b);
  
  // 1. No permitir TODA la combinación consecutiva (muy raro)
  if (isConsecutiveSorted(sorted)) return false;
  
  // 2. Máximo 2 pares consecutivos
  if (countConsecutivePairs(sorted) > REGLAS.maxConsecutivos) return false;
  
  // 3. Paridad balanceada (2-3 pares)
  const pares = countPares(arr);
  if (pares < REGLAS.minPares || pares > REGLAS.maxPares) return false;
  
  // 4. Suma dentro del rango
  const s = suma(arr);
  if (s < REGLAS.sumaMin || s > REGLAS.sumaMax) return false;
  
  // 5. Distribución de rangos
  if (REGLAS.distribucionRangos && !hasBalancedRanges(arr)) return false;
  
  return true;
}

function loadBalotas() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const all = JSON.parse(raw);
    return Array.isArray(all) ? all : [];
  } catch (e) {
    return [];
  }
}

function buildUsedSet(balotas) {
  const used = new Set();
  for (const b of balotas) {
    const key = tupleKey([b.balota_1, b.balota_2, b.balota_3, b.balota_4, b.balota_5]);
    used.add(key);
  }
  return used;
}

function* combinations(n, k) {
  const combo = Array.from({length: k}, (_, i) => i + 1);
  while (true) {
    yield combo.slice();
    let i = k - 1;
    while (i >= 0 && combo[i] === n - k + 1 + i) i--;
    if (i < 0) break;
    combo[i]++;
    for (let j = i + 1; j < k; j++) combo[j] = combo[j-1] + 1;
  }
}

function remainingCombinations(usedSet, applyRules = true) {
  const gen = combinations(NUM_BALLS, PICK);
  const results = [];
  for (const c of gen) {
    const key = tupleKey(c);
    if (usedSet.has(key)) continue;
    
    // Aplicar reglas de patrones
    if (!passReglas(c, applyRules)) continue;
    
    results.push(c);
  }
  return results;
}

// Generar combinación inteligente con ponderación de números calientes
function generateSmartCombination(usedSet, applyRules = true) {
  const maxAttempts = 10000;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    const combo = [];
    
    // 50% de probabilidad de incluir 1-2 números calientes
    const useHot = Math.random() < 0.5;
    if (useHot) {
      const numHot = Math.random() < 0.5 ? 1 : 2;
      for (let i = 0; i < numHot; i++) {
        const hotNum = NUMEROS_CALIENTES[Math.floor(Math.random() * NUMEROS_CALIENTES.length)];
        if (!combo.includes(hotNum)) combo.push(hotNum);
      }
    }
    
    // 30% de probabilidad de incluir un par caliente
    const useHotPair = Math.random() < 0.3 && combo.length <= 3;
    if (useHotPair) {
      const pair = PARES_CALIENTES[Math.floor(Math.random() * PARES_CALIENTES.length)];
      if (!combo.includes(pair[0]) && !combo.includes(pair[1])) {
        combo.push(pair[0], pair[1]);
      }
    }
    
    // Completar con números aleatorios
    while (combo.length < PICK) {
      const rnd = Math.floor(Math.random() * NUM_BALLS) + 1;
      if (!combo.includes(rnd)) combo.push(rnd);
    }
    
    // Verificar que no esté usada y pase las reglas
    const key = tupleKey(combo);
    if (usedSet.has(key)) continue;
    if (!passReglas(combo, applyRules)) continue;
    
    return combo.sort((a, b) => a - b);
  }
  
  // Si no se encuentra, generar simple
  return null;
}

function sampleRandom(pool, n) {
  if (n >= pool.length) return pool.slice(0, n);
  const res = [];
  const usedIdx = new Set();
  while (res.length < n) {
    const idx = Math.floor(Math.random() * pool.length);
    if (usedIdx.has(idx)) continue;
    usedIdx.add(idx);
    res.push(pool[idx]);
  }
  return res;
}

// Generar N combinaciones inteligentes (método rápido)
function generateSmartCombinations(usedSet, n, applyRules = true) {
  const results = [];
  const localUsed = new Set(usedSet);
  
  for (let i = 0; i < n; i++) {
    const combo = generateSmartCombination(localUsed, applyRules);
    if (combo) {
      results.push(combo);
      localUsed.add(tupleKey(combo));
    } else {
      console.log(`⚠️  No se pudo generar la combinación ${i + 1} después de varios intentos`);
    }
  }
  
  return results;
}

function saveBalotas(all) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf8');
}

function registerDraw(numbers, superBalota = null, fecha = null) {
  const all = loadBalotas();
  const id = Date.now().toString();
  const sortedNums = numbers.slice().sort((a,b)=>a-b);
  const nueva = {
    id,
    balota_1: sortedNums[0],
    balota_2: sortedNums[1],
    balota_3: sortedNums[2],
    balota_4: sortedNums[3],
    balota_5: sortedNums[4],
    super_balota: superBalota !== null ? Number(superBalota) : 0,
    fecha_sorteo: fecha || new Date().toISOString().slice(0,10),
    repetida: false,
    cantidad_repeticiones: 0
  };
  all.push(nueva);
  saveBalotas(all);
  return nueva;
}

function printUsage() {
  console.log('Uso: node generador/generador.js <comando> [opciones]');
  console.log('Comandos:');
  console.log('  generate --n N [--smart] [--no-rules]   Genera N combinaciones');
  console.log('    --smart: Usa generación inteligente con números calientes (recomendado)');
  console.log('    --no-rules: Ignora reglas de patrones');
  console.log('  stats [--no-rules]                       Muestra totales y restantes');
  console.log('  register n1 n2 n3 n4 n5 [super] [fecha]  Registra un sorteo en balotas.json');
  console.log('  rules                                     Muestra las reglas configuradas');
}

function printRules() {
  console.log('\n📋 Reglas de Generación Basadas en Patrones Históricos:\n');
  console.log('✅ Permitir hasta', REGLAS.maxConsecutivos, 'pares de números consecutivos');
  console.log('✅ Paridad:', REGLAS.minPares, '-', REGLAS.maxPares, 'números pares');
  console.log('✅ Suma total: entre', REGLAS.sumaMin, 'y', REGLAS.sumaMax);
  console.log('✅ Distribución equilibrada: al menos 1 número de cada rango (bajo/medio/alto)');
  console.log('\n🔥 Números calientes (más frecuentes):', NUMEROS_CALIENTES.slice(0, 10).join(', '));
  console.log('🤝 Pares calientes:', PARES_CALIENTES.slice(0, 5).map(p => p.join('-')).join(', '), '...\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) return printUsage();
  const cmd = argv[0];
  const balotas = loadBalotas();
  const used = buildUsedSet(balotas);

  if (cmd === 'rules') {
    return printRules();
  }

  if (cmd === 'generate') {
    const nIdx = argv.indexOf('--n');
    let n = 1;
    if (nIdx !== -1 && argv[nIdx+1]) n = Math.max(1, Number(argv[nIdx+1]));
    
    const useSmart = argv.includes('--smart');
    const applyRules = !argv.includes('--no-rules');
    
    const totalPossible = factorialChoose(NUM_BALLS, PICK);
    
    console.log('🎲 Generador de Combinaciones Mejorado\n');
    console.log('Total posibles C(' + NUM_BALLS + ',' + PICK + ') =', totalPossible.toLocaleString());
    console.log('Ya usadas (según balotas.json):', used.size.toLocaleString());
    console.log('Método:', useSmart ? '🔥 Inteligente (con números calientes)' : '🎯 Aleatorio simple');
    console.log('Reglas:', applyRules ? '✅ Aplicadas' : '❌ Desactivadas');
    console.log('\n' + '='.repeat(50) + '\n');
    
    if (useSmart) {
      // Generación inteligente (rápido)
      const combinations = generateSmartCombinations(used, n, applyRules);
      for (const c of combinations) {
        const s = suma(c);
        const pares = countPares(c);
        const consec = countConsecutivePairs(c);
        console.log(c.join(' ').padEnd(20), 
                   `| Suma: ${s}`.padEnd(12), 
                   `| Pares: ${pares}/${5-pares}`.padEnd(16),
                   consec > 0 ? `| Consec: ${consec}` : '');
      }
    } else {
      // Generación por pool completo (lento para muchos casos)
      console.log('⏳ Cargando Pool de combinaciones (puede tardar)...');
      const pool = remainingCombinations(used, applyRules);
      console.log('Restantes disponibles:', pool.length.toLocaleString());
      console.log('\nCombinaciones generadas:\n');
      const samples = sampleRandom(pool, n);
      for (const s of samples) {
        const sum = suma(s);
        const pares = countPares(s);
        const consec = countConsecutivePairs(s);
        console.log(s.join(' ').padEnd(20), 
                   `| Suma: ${sum}`.padEnd(12), 
                   `| Pares: ${pares}/${5-pares}`.padEnd(16),
                   consec > 0 ? `| Consec: ${consec}` : '');
      }
    }
    return;
  }

  if (cmd === 'stats') {
    const applyRules = !argv.includes('--no-rules');
    console.log('📊 Estadísticas del Generador\n');
    console.log('⏳ Construyendo conteo...');
    const pool = remainingCombinations(used, applyRules);
    const totalPossible = factorialChoose(NUM_BALLS, PICK);
    console.log('\nTotal posibles C(' + NUM_BALLS + ',' + PICK + '):', totalPossible.toLocaleString());
    console.log('Ya usadas (según balotas.json):', used.size.toLocaleString(), 
                '(' + ((used.size / totalPossible) * 100).toFixed(4) + '%)');
    console.log('Restantes (con reglas):', pool.length.toLocaleString(),
                '(' + ((pool.length / totalPossible) * 100).toFixed(2) + '%)');
    console.log('\nReglas aplicadas:', applyRules ? '✅ SÍ' : '❌ NO');
    if (applyRules) printRules();
    return;
  }

  if (cmd === 'register') {
    if (argv.length < 6) return printUsage();
    const nums = argv.slice(1, 6).map(x => Number(x));
    if (nums.some(n => isNaN(n))) return console.error('Números inválidos');
    const superBalota = argv[6] ? Number(argv[6]) : null;
    const fecha = argv[7] || null;
    const nueva = registerDraw(nums, superBalota, fecha);
    console.log('✅ Registrada:', nueva);
    return;
  }

  printUsage();
}

function factorialChoose(n, k) {
  // compute C(n,k)
  k = Math.min(k, n-k);
  let num = 1, den = 1;
  for (let i = 0; i < k; i++) {
    num *= (n - i);
    den *= (i + 1);
  }
  return num / den;
}

main();
