const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'balotas.json');
const OUTPUT_FILE = path.join(__dirname, 'PATRONES.md');

function yearOf(fecha) {
  try {
    return new Date(fecha).getFullYear();
  } catch (e) {
    return null;
  }
}

function getDecena(num) {
  return Math.floor((num - 1) / 10);
}

function analizarPatrones() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const all = JSON.parse(raw);

  const fromYear = 2021, toYear = 2026;
  const draws = all.filter(d => {
    const y = yearOf(d.fecha_sorteo);
    return y >= fromYear && y <= toYear;
  });

  const totalDraws = draws.length;

  // 1. FRECUENCIA DE NÚMEROS INDIVIDUALES
  const frecuencias = {};
  for (let i = 1; i <= 43; i++) frecuencias[i] = 0;

  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5];
    for (const n of nums) {
      if (n >= 1 && n <= 43) frecuencias[n]++;
    }
  }

  const frecOrdenadas = Object.entries(frecuencias)
    .map(([num, count]) => ({ num: Number(num), count }))
    .sort((a, b) => b.count - a.count);

  // 2. NÚMEROS DE LA MISMA DECENA JUNTOS
  const decenasJuntas = {};
  for (let d = 0; d <= 4; d++) decenasJuntas[d] = 0;

  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].map(n => Number(n));
    const decenas = nums.map(n => getDecena(n));
    const decentaCount = {};
    for (const dec of decenas) {
      decentaCount[dec] = (decentaCount[dec] || 0) + 1;
    }
    for (const [dec, count] of Object.entries(decentaCount)) {
      if (count >= 2) {
        decenasJuntas[dec]++;
      }
    }
  }

  // 3. PARES DE NÚMEROS QUE SALEN JUNTOS
  const pares = {};
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5]
      .map(n => Number(n))
      .sort((a, b) => a - b);
    
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = `${nums[i]}-${nums[j]}`;
        pares[key] = (pares[key] || 0) + 1;
      }
    }
  }

  const paresOrdenados = Object.entries(pares)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count);

  // 4. PATRONES DE PARIDAD (PARES vs IMPARES)
  const patronesParidad = { '5-0': 0, '4-1': 0, '3-2': 0, '2-3': 0, '1-4': 0, '0-5': 0 };
  
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].map(n => Number(n));
    const pares = nums.filter(n => n % 2 === 0).length;
    const impares = 5 - pares;
    const key = `${pares}-${impares}`;
    if (patronesParidad[key] !== undefined) patronesParidad[key]++;
  }

  // 5. DISTRIBUCIÓN DE RANGOS (1-14 bajo, 15-29 medio, 30-43 alto)
  const rangos = { bajo: 0, medio: 0, alto: 0 };
  const patronesRango = {};

  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].map(n => Number(n));
    let bajo = 0, medio = 0, alto = 0;
    
    for (const n of nums) {
      if (n <= 14) bajo++;
      else if (n <= 29) medio++;
      else alto++;
    }
    
    const key = `${bajo}-${medio}-${alto}`;
    patronesRango[key] = (patronesRango[key] || 0) + 1;
  }

  const patronesRangoOrdenados = Object.entries(patronesRango)
    .map(([patron, count]) => ({ patron, count }))
    .sort((a, b) => b.count - a.count);

  // 6. NÚMEROS CONSECUTIVOS
  let sorteosConConsecutivos = 0;
  let totalConsecutivos = 0;

  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5]
      .map(n => Number(n))
      .sort((a, b) => a - b);
    
    let hayConsecutivo = false;
    let contadorConsecutivos = 0;
    
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] - nums[i] === 1) {
        hayConsecutivo = true;
        contadorConsecutivos++;
      }
    }
    
    if (hayConsecutivo) sorteosConConsecutivos++;
    totalConsecutivos += contadorConsecutivos;
  }

  // 7. SUMA TOTAL DE COMBINACIONES
  const sumas = [];
  for (const d of draws) {
    const nums = [d.balota_1, d.balota_2, d.balota_3, d.balota_4, d.balota_5].map(n => Number(n));
    const suma = nums.reduce((a, b) => a + b, 0);
    sumas.push(suma);
  }
  
  sumas.sort((a, b) => a - b);
  const sumaMin = sumas[0];
  const sumaMax = sumas[sumas.length - 1];
  const sumaPromedio = sumas.reduce((a, b) => a + b, 0) / sumas.length;
  const sumaMediana = sumas[Math.floor(sumas.length / 2)];

  // 8. NÚMEROS MÁS Y MENOS FRECUENTES
  const top10Frecuentes = frecOrdenadas.slice(0, 10);
  const top10Raros = frecOrdenadas.slice(-10).reverse();

  // GENERAR MARKDOWN
  const lines = [];
  lines.push('# 🎯 Análisis de Patrones de Sorteos (2021-2026)\n');
  lines.push(`**Total de sorteos analizados:** ${totalDraws}\n`);
  lines.push('---\n');

  // SECCIÓN 1: FRECUENCIA DE NÚMEROS
  lines.push('## 📊 1. Frecuencia de Números Individuales\n');
  lines.push('### Top 10 números MÁS frecuentes:\n');
  lines.push('| Posición | Número | Veces | Porcentaje |');
  lines.push('|----------|--------|-------|------------|');
  for (let i = 0; i < top10Frecuentes.length; i++) {
    const { num, count } = top10Frecuentes[i];
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${i + 1} | **${num}** | ${count} | ${pct}% |`);
  }
  lines.push('');
  
  lines.push('### Top 10 números MENOS frecuentes:\n');
  lines.push('| Posición | Número | Veces | Porcentaje |');
  lines.push('|----------|--------|-------|------------|');
  for (let i = 0; i < top10Raros.length; i++) {
    const { num, count } = top10Raros[i];
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${i + 1} | **${num}** | ${count} | ${pct}% |`);
  }
  lines.push('\n---\n');

  // SECCIÓN 2: NÚMEROS DE LA MISMA DECENA
  lines.push('## 👨‍👩‍👧‍👦 2. Números de la Misma Familia (Decena) en Sorteos\n');
  lines.push('Análisis de sorteos donde salen 2 o más números de la misma decena:\n');
  lines.push('| Familia | Números | Sorteos con 2+ juntos | Porcentaje |');
  lines.push('|---------|---------|----------------------|------------|');
  const familias = [
    { nombre: '1-10', rango: '(1-10)', decena: 0 },
    { nombre: '11-20', rango: '(11-20)', decena: 1 },
    { nombre: '21-30', rango: '(21-30)', decena: 2 },
    { nombre: '31-40', rango: '(31-40)', decena: 3 },
    { nombre: '41-43', rango: '(41-43)', decena: 4 }
  ];
  for (const fam of familias) {
    const count = decenasJuntas[fam.decena] || 0;
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${fam.nombre} | ${fam.rango} | ${count} | ${pct}% |`);
  }
  lines.push('\n**Conclusión:** La mayoría de sorteos tienen números de diferentes familias, pero es común que 2 números sean de la misma decena.\n');
  lines.push('---\n');

  // SECCIÓN 3: PARES FRECUENTES
  lines.push('## 🤝 3. Pares de Números que Salen Juntos Frecuentemente\n');
  lines.push('Top 20 pares que más veces han salido en el mismo sorteo:\n');
  lines.push('| Ranking | Par | Veces Juntos | Porcentaje de sorteos |');
  lines.push('|---------|-----|--------------|----------------------|');
  for (let i = 0; i < Math.min(20, paresOrdenados.length); i++) {
    const { pair, count } = paresOrdenados[i];
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${i + 1} | **${pair}** | ${count} | ${pct}% |`);
  }
  lines.push('\n---\n');

  // SECCIÓN 4: PARIDAD
  lines.push('## ⚖️ 4. Patrones de Paridad (Pares vs Impares)\n');
  lines.push('Distribución de números pares e impares en cada sorteo:\n');
  lines.push('| Patrón (Pares-Impares) | Cantidad | Porcentaje |');
  lines.push('|------------------------|----------|------------|');
  for (const [patron, count] of Object.entries(patronesParidad).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${patron} | ${count} | ${pct}% |`);
  }
  lines.push('\n**Conclusión:** El patrón más equilibrado (3-2 o 2-3) suele ser más común.\n');
  lines.push('---\n');

  // SECCIÓN 5: RANGOS
  lines.push('## 📏 5. Distribución por Rangos (Bajo-Medio-Alto)\n');
  lines.push('- **Bajo:** 1-14\n');
  lines.push('- **Medio:** 15-29\n');
  lines.push('- **Alto:** 30-43\n\n');
  lines.push('Top 15 patrones más comunes (Bajo-Medio-Alto):\n');
  lines.push('| Patrón | Cantidad | Porcentaje |');
  lines.push('|--------|----------|------------|');
  for (let i = 0; i < Math.min(15, patronesRangoOrdenados.length); i++) {
    const { patron, count } = patronesRangoOrdenados[i];
    const pct = ((count / totalDraws) * 100).toFixed(2);
    lines.push(`| ${patron} | ${count} | ${pct}% |`);
  }
  lines.push('\n**Conclusión:** La mayoría de sorteos tienen una distribución equilibrada entre los 3 rangos.\n');
  lines.push('---\n');

  // SECCIÓN 6: CONSECUTIVOS
  lines.push('## 🔢 6. Números Consecutivos\n');
  lines.push(`- **Sorteos con al menos 2 números consecutivos:** ${sorteosConConsecutivos} de ${totalDraws} (${((sorteosConConsecutivos / totalDraws) * 100).toFixed(2)}%)\n`);
  lines.push(`- **Total de pares consecutivos encontrados:** ${totalConsecutivos}\n`);
  lines.push(`- **Promedio de pares consecutivos por sorteo:** ${(totalConsecutivos / totalDraws).toFixed(2)}\n`);
  lines.push('\n**Conclusión:** Es muy común tener al menos 2 números consecutivos en un sorteo. Excluir TODAS las secuencias consecutivas (como 1-2) podría eliminar muchas combinaciones válidas.\n');
  lines.push('---\n');

  // SECCIÓN 7: SUMA TOTAL
  lines.push('## ➕ 7. Suma Total de las Combinaciones\n');
  lines.push(`- **Suma mínima observada:** ${sumaMin}\n`);
  lines.push(`- **Suma máxima observada:** ${sumaMax}\n`);
  lines.push(`- **Suma promedio:** ${sumaPromedio.toFixed(2)}\n`);
  lines.push(`- **Suma mediana:** ${sumaMediana}\n`);
  lines.push('\n**Rango recomendado para generador:** Entre ${Math.round(sumaPromedio - 20)} y ${Math.round(sumaPromedio + 20)}\n');
  lines.push('---\n');

  // RECOMENDACIONES
  lines.push('## 💡 Recomendaciones para Mejorar el Generador\n');
  lines.push('Basándose en los patrones históricos:\n\n');
  
  lines.push('### ✅ Reglas que DEBERÍAS aplicar:\n');
  lines.push('1. **Priorizar números frecuentes:** Incluir al menos 2-3 números del top 20 más frecuentes\n');
  lines.push('2. **Paridad equilibrada:** Preferir combinaciones con 2-3 pares y 2-3 impares\n');
  lines.push('3. **Distribución de rangos:** Incluir números de los 3 rangos (bajo, medio, alto)\n');
  lines.push('4. **Suma total:** Mantener la suma entre 90 y 140 aproximadamente\n');
  lines.push('5. **Pares frecuentes:** Considerar incluir algunos de los pares que históricamente salen juntos\n');
  lines.push('6. **PERMITIR consecutivos:** Permitir al menos 1-2 números consecutivos en la combinación\n\n');
  
  lines.push('### ❌ Reglas que NO deberías aplicar (demasiado restrictivas):\n');
  lines.push('1. **Excluir TODOS los consecutivos:** Históricamente, el ' + ((sorteosConConsecutivos / totalDraws) * 100).toFixed(0) + '% de sorteos tienen consecutivos\n');
  lines.push('2. **Evitar números de la misma decena:** Es común tener 2 números de la misma familia\n');
  lines.push('3. **Solo números impares o solo pares:** Los patrones extremos (5-0 o 0-5) son muy raros\n\n');

  lines.push('### 🎲 Configuración sugerida para el generador:\n');
  lines.push('```javascript\n');
  lines.push('const REGLAS = {\n');
  lines.push('  // Permitir 1-2 pares consecutivos (no toda la combinación)\n');
  lines.push('  maxConsecutivos: 2,  // máximo 2 números consecutivos en la combinación\n');
  lines.push('  \n');
  lines.push('  // Paridad: 2 o 3 pares/impares\n');
  lines.push('  minPares: 2,\n');
  lines.push('  maxPares: 3,\n');
  lines.push('  \n');
  lines.push('  // Suma total\n');
  lines.push(`  sumaMin: ${Math.round(sumaPromedio - 25)},\n`);
  lines.push(`  sumaMax: ${Math.round(sumaPromedio + 25)},\n`);
  lines.push('  \n');
  lines.push('  // Distribución por rangos (cada rango debe tener al menos 1)\n');
  lines.push('  minPorRango: 1,\n');
  lines.push('  \n');
  lines.push('  // Priorizar números frecuentes (probabilidad aumentada)\n');
  lines.push('  numerosCalientes: [' + top10Frecuentes.slice(0, 15).map(x => x.num).join(', ') + '],\n');
  lines.push('};\n');
  lines.push('```\n');

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'));
  console.log(`✅ Análisis de patrones completado. Reporte generado en ${OUTPUT_FILE}`);
}

analizarPatrones();
