Generador de combinaciones — carpeta `generador`

Archivos:
- `generador.js`: script Node.js para generar combinaciones inteligentes basadas en patrones históricos.

Comandos:

- **Generar N combinaciones (modo inteligente - RECOMENDADO):**

  node generador/generador.js generate --n 5 --smart

- **Generar sin aplicar reglas de patrones:**

  node generador/generador.js generate --n 5 --smart --no-rules

- **Ver estadísticas (total posibles, usadas, restantes):**

  node generador/generador.js stats

- **Ver las reglas configuradas:**

  node generador/generador.js rules

- **Registrar un sorteo (se agrega a `balotas.json`):**

  node generador/generador.js register 2 10 15 22 25 8 2026-01-18

## 🎯 Mejoras del Generador

El generador ahora incluye reglas inteligentes basadas en análisis de patrones históricos (2021-2026):

### ✅ Reglas Aplicadas:
1. **Números consecutivos:** Permite hasta 2 pares consecutivos (ej: 5-6, 12-13) pero no toda la serie (1-2-3-4-5)
2. **Paridad balanceada:** Prefiere combinaciones con 2-3 números pares y 2-3 impares
3. **Suma total:** Mantiene la suma entre 86 y 136 (rango histórico óptimo)
4. **Distribución de rangos:** Incluye números de los 3 rangos (bajo 1-14, medio 15-29, alto 30-43)

### 🔥 Modo Inteligente (`--smart`):
- Prioriza números que históricamente salen más frecuentemente
- Considera pares de números que frecuentemente aparecen juntos
- Genera combinaciones más rápido sin necesidad de cargar todo el pool

### 📊 Basado en Datos Reales:
- **40% de sorteos tienen números consecutivos** → Ya no se excluyen todos
- **64% tienen paridad equilibrada (2-3 pares)** → Se prioriza este patrón
- **Suma promedio: 110** → Se generan combinaciones cerca de este valor

Notas:
- El script lee `balotas.json` desde la carpeta padre del directorio `generador`.
- Las combinaciones ya registradas se almacenan en `balotas.json` y se excluyen automáticamente.
- El modo `--smart` es mucho más rápido y genera mejores combinaciones basadas en patrones reales.
