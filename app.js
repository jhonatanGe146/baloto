// Configuración de la API
const API_URL = 'http://localhost:3000/api';

// Base de datos en memoria (se sincroniza con el servidor)
let balotas = [];

// Cargar datos desde el servidor
async function cargarDatos() {
    try {
        const response = await fetch(`${API_URL}/balotas`);
        if (!response.ok) throw new Error('Error al cargar datos');
        const datos = await response.json();
        return datos;
    } catch (error) {
        console.error('Error al cargar datos:', error);
        alert('⚠️ Error al conectar con el servidor. Asegúrate de que el servidor esté ejecutándose.');
        return [];
    }
}

// Guardar datos en el servidor
async function guardarDatos() {
    try {
        const response = await fetch(`${API_URL}/balotas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(balotas)
        });
        
        if (!response.ok) throw new Error('Error al guardar datos');
        const result = await response.json();
        console.log('✅ Datos guardados en balotas.json');
        return result;
    } catch (error) {
        console.error('Error al guardar datos:', error);
        alert('⚠️ Error al guardar los datos en el archivo.');
    }
}

// Funciones de la base de datos
// Crear una firma invariante al orden para las 5 balotas principales + super balota
function firmaBalotas(b) {
    const nums = [b.balota_1, b.balota_2, b.balota_3, b.balota_4, b.balota_5]
        .map(n => Number(n))
        .sort((a, c) => a - c)
        .join(',');
    return `${nums}|${Number(b.super_balota)}`;
}

// Firma que IGNORA la super_balota (solo las 5 balotas principales, orden-insensible)
function firmaSoloBalotas(b) {
    const nums = [b.balota_1, b.balota_2, b.balota_3, b.balota_4, b.balota_5]
        .map(n => Number(n))
        .sort((a, c) => a - c)
        .join(',');
    return `${nums}`;
}

function obtenerTodasLasBalotas() {
    return balotas.sort((a, b) => 
        new Date(b.fecha_sorteo).getTime() - new Date(a.fecha_sorteo).getTime()
    );
}

function obtenerBalotasRepetidas() {
    return balotas.filter(b => b.repetida);
}

function obtenerBalotasRepetidasConSuper() {
    return balotas.filter(b => b.repetida_con_super);
}

function agregarBalota(nuevaBalota) {
    const id = Date.now().toString();

    // Nota: ya no se valida la misma fecha; se permiten varios sorteos el mismo día

    // Buscar combinaciones iguales independientemente del orden de las balotas principales
    const nuevaFirma = firmaBalotas({
        balota_1: nuevaBalota.balota_1,
        balota_2: nuevaBalota.balota_2,
        balota_3: nuevaBalota.balota_3,
        balota_4: nuevaBalota.balota_4,
        balota_5: nuevaBalota.balota_5,
        super_balota: nuevaBalota.super_balota
    });

    const combinacionExistente = balotas.find(b => firmaBalotas(b) === nuevaFirma);

    let repetida = false;
    let cantidad_repeticiones = 0;

    if (combinacionExistente) {
        combinacionExistente.repetida = true;
        combinacionExistente.cantidad_repeticiones += 1;
        repetida = true;
        cantidad_repeticiones = combinacionExistente.cantidad_repeticiones;
    }

    const balota = {
        id,
        ...nuevaBalota,
        repetida,
        cantidad_repeticiones
    };

    balotas.push(balota);
    guardarDatos(); // Guardar cambios
    return balota;
}

function eliminarBalota(id) {
    const index = balotas.findIndex(b => b.id === id);
    if (index !== -1) {
        balotas.splice(index, 1);
        // Recalcular repetidas (esto ya guarda automáticamente)
        recalcularRepetidas(true);
        return true;
    }
    return false;
}

function recalcularRepetidas(guardar = true) {
    // Reiniciar todas las balotas
    balotas.forEach(b => {
        b.repetida = false;
        b.cantidad_repeticiones = 0;
        b.repetida_con_super = false;
        b.cantidad_repeticiones_con_super = 0;
    });

    // Verificar combinaciones repetidas siendo invariante al orden de las balotas principales
    // 1) Repeticiones IGNORANDO super_balota
    const mapaSinSuper = new Map(); // firmaSoloBalotas -> array of indices
    for (let i = 0; i < balotas.length; i++) {
        const f = firmaSoloBalotas(balotas[i]);
        if (!mapaSinSuper.has(f)) mapaSinSuper.set(f, []);
        mapaSinSuper.get(f).push(i);
    }

    for (const [f, indices] of mapaSinSuper.entries()) {
        if (indices.length > 1) {
            const repCount = indices.length - 1;
            indices.forEach(idx => {
                balotas[idx].repetida = true;
                balotas[idx].cantidad_repeticiones = repCount;
            });
        }
    }

    // 2) Repeticiones EXACTAS que INCLUYEN super_balota
    const mapaConSuper = new Map(); // firmaBalotas -> array of indices
    for (let i = 0; i < balotas.length; i++) {
        const f = firmaBalotas(balotas[i]);
        if (!mapaConSuper.has(f)) mapaConSuper.set(f, []);
        mapaConSuper.get(f).push(i);
    }

    for (const [f, indices] of mapaConSuper.entries()) {
        if (indices.length > 1) {
            const repCount = indices.length - 1;
            indices.forEach(idx => {
                balotas[idx].repetida_con_super = true;
                balotas[idx].cantidad_repeticiones_con_super = repCount;
            });
        }
    }
    
    // Guardar después de recalcular solo si se solicita
    if (guardar) {
        guardarDatos();
    }
}

// Procesar archivo `balotas_sin_formatear.json`, formatear y agregar registros
async function procesarBalotasSinFormatear() {
    if (!confirm('¿Deseas procesar y agregar los registros de balotas_sin_formatear.json? Esto añadirá registros a balotas.json.')) return;

    try {
        const resp = await fetch('/balotas_sin_formatear.json');
        if (!resp.ok) throw new Error('No se pudo leer balotas_sin_formatear.json');

        const raw = await resp.json();
        if (!Array.isArray(raw) || raw.length === 0) {
            alert('No se encontraron registros en balotas_sin_formatear.json');
            return;
        }

        let agregados = 0;
        for (let i = 0; i < raw.length; i++) {
            const r = raw[i];
            const nueva = {
                balota_1: Number(r.balota_1),
                balota_2: Number(r.balota_2),
                balota_3: Number(r.balota_3),
                balota_4: Number(r.balota_4),
                balota_5: Number(r.balota_5),
                super_balota: Number(r.super_balota),
                fecha_sorteo: r.fecha_sorteo || new Date().toISOString().slice(0,10)
            };

            // Basic validation: require a fecha
            if (!nueva.fecha_sorteo) continue;

            const res = agregarBalota(nueva);
            if (res) agregados++;
        }

        // Ya que agregarBalota guarda por cada inserción, solo recalculamos y renderizamos
        recalcularRepetidas(true);
        renderizar();
        alert(`✅ Procesados ${agregados} registros y guardados en balotas.json`);
    } catch (error) {
        console.error('Error procesando balotas sin formatear:', error);
        alert('⚠️ Error al procesar los datos. Revisa la consola para más detalles.');
    }
}

// Exponer la función para el botón
window.procesarBalotasSinFormatear = procesarBalotasSinFormatear;

// Funciones de renderizado
function crearCardBalota(balota) {
    const card = document.createElement('div');
    card.className = `balota-card ${balota.repetida ? 'repetida' : ''}`;
    
    const fecha = new Date(balota.fecha_sorteo + 'T00:00:00').toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    // Construir estatuses: repetida (sin super) y repetida_con_super
    let statusHtml = '';
    if (balota.repetida) {
        statusHtml += `<div class="card-status status-repetida">✅ Repetida (sin super) - Repeticiones: ${balota.cantidad_repeticiones}</div>`;
    } else {
        statusHtml += `<div class="card-status status-normal">🎯 Primera vez (sin super)</div>`;
    }

    if (balota.repetida_con_super) {
        statusHtml += `<div class="card-status status-repetida" style="margin-top:6px;">🔁 Repetida (idéntica con super) - Repeticiones: ${balota.cantidad_repeticiones_con_super}</div>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <div class="card-fecha">📅 ${fecha}</div>
            <button class="btn-delete" onclick="handleEliminar('${balota.id}')" title="Eliminar">✕</button>
        </div>
        <div class="balotas-display">
            <div class="balota-numero">${balota.balota_1}</div>
            <div class="balota-numero">${balota.balota_2}</div>
            <div class="balota-numero">${balota.balota_3}</div>
            <div class="balota-numero">${balota.balota_4}</div>
            <div class="balota-numero">${balota.balota_5}</div>
            <div class="balota-separator">+</div>
            <div class="balota-numero super-balota">${balota.super_balota}</div>
        </div>
        ${statusHtml}
    `;

    return card;
}

function renderizarSorteos() {
    // Renderizar tabla paginada en vez de solo cards
    renderTablaSorteos();
}

// Tabla, orden y paginación
let tablaPaginaActual = 1;
const tablaPageSize = 10;
let tablaOrdenAsc = false; // por defecto descendente

function toggleTablaOrden() {
    tablaOrdenAsc = !tablaOrdenAsc;
    tablaPaginaActual = 1;
    renderTablaSorteos();
}

function gotoTablaPagina(n) {
    tablaPaginaActual = n;
    renderTablaSorteos();
}

// Exponer para los botones inline
window.toggleTablaOrden = toggleTablaOrden;
window.gotoTablaPagina = gotoTablaPagina;

function renderTablaSorteos() {
    const container = document.getElementById('sorteos-table-container');
    if (!container) return;

    const todas = obtenerTodasLasBalotas();
    const sorted = todas.slice().sort((a,b) => {
        const da = new Date(a.fecha_sorteo).getTime();
        const db = new Date(b.fecha_sorteo).getTime();
        return tablaOrdenAsc ? da - db : db - da;
    });

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / tablaPageSize));
    if (tablaPaginaActual > totalPages) tablaPaginaActual = totalPages;

    const start = (tablaPaginaActual - 1) * tablaPageSize;
    const pageItems = sorted.slice(start, start + tablaPageSize);

    if (total === 0) {
        container.innerHTML = '<div class="empty-message">📭 No hay sorteos registrados aún</div>';
        return;
    }

    // Construir tabla
    let html = '';
    html += `<div class="table-actions">`;
    html += `<button class="btn" onclick="toggleTablaOrden()">Orden: ${tablaOrdenAsc ? 'Ascendente' : 'Descendente'}</button>`;
    html += `</div>`;
    html += `<table class="sorteos-table"><thead><tr><th>Fecha</th><th>Balotas</th><th>Super</th><th>Estatus</th><th>Acción</th></tr></thead><tbody>`;

    for (const b of pageItems) {
        const fecha = new Date(b.fecha_sorteo + 'T00:00:00').toLocaleDateString('es-ES');
        const balotasText = `${b.balota_1} - ${b.balota_2} - ${b.balota_3} - ${b.balota_4} - ${b.balota_5}`;
        const est = b.repetida ? `Repetida (sin super) x${b.cantidad_repeticiones}` : 'Primera vez';
        html += `<tr>`;
        html += `<td>${fecha}</td>`;
        html += `<td>${balotasText}</td>`;
        html += `<td><span class="super-circle">${b.super_balota}</span></td>`;
        html += `<td>${est}</td>`;
        html += `<td><button class="btn btn-delete-small" onclick="handleEliminar('${b.id}')">Eliminar</button></td>`;
        html += `</tr>`;
    }

    html += `</tbody></table>`;

    // Paginación: Prev / pages / Next
    html += `<div class="pagination">`;
    // Prev
    if (tablaPaginaActual === 1) {
        html += `<button class="page" disabled>Anterior</button>`;
    } else {
        html += `<button class="page" onclick="gotoTablaPagina(${tablaPaginaActual - 1})">Anterior</button>`;
    }

    const maxShown = 10;
    const pagesToShow = Math.min(totalPages, maxShown);
    for (let p = 1; p <= pagesToShow; p++) {
        if (p === tablaPaginaActual) {
            html += `<button class="page active">${p}</button>`;
        } else {
            html += `<button class="page" onclick="gotoTablaPagina(${p})">${p}</button>`;
        }
    }
    if (totalPages > maxShown) {
        html += `<span class="ellipsis">...</span>`;
        if (tablaPaginaActual === totalPages) {
            html += `<button class="page active">${totalPages}</button>`;
        } else {
            html += `<button class="page" onclick="gotoTablaPagina(${totalPages})">${totalPages}</button>`;
        }
    }

    // Next
    if (tablaPaginaActual >= totalPages) {
        html += `<button class="page" disabled>Siguiente</button>`;
    } else {
        html += `<button class="page" onclick="gotoTablaPagina(${tablaPaginaActual + 1})">Siguiente</button>`;
    }

    html += `</div>`;

    container.innerHTML = html;
}

function renderizarRepetidas() {
    const container = document.getElementById('repetidas-container');
    const balotasRepetidas = obtenerBalotasRepetidas();

    if (balotasRepetidas.length === 0) {
        container.innerHTML = '<div class="empty-message">🎲 No hay combinaciones repetidas aún</div>';
        return;
    }

    container.innerHTML = '';
    balotasRepetidas.forEach(balota => {
        container.appendChild(crearCardBalota(balota));
    });
}

function renderizarRepetidasConSuper() {
    const container = document.getElementById('repetidas-con-super-container');
    const balotasRepetidas = obtenerBalotasRepetidasConSuper();

    if (!container) return;

    if (balotasRepetidas.length === 0) {
        container.innerHTML = '<div class="empty-message">🔍 No hay combinaciones idénticas (incluye super) aún</div>';
        return;
    }

    container.innerHTML = '';
    balotasRepetidas.forEach(balota => {
        container.appendChild(crearCardBalota(balota));
    });
}

function renderizar() {
    renderizarSorteos();
    renderizarRepetidas();
    renderizarRepetidasConSuper();
}

// Manejadores de eventos
function handleEliminar(id) {
    // Eliminar sin confirmación
    eliminarBalota(id);
    renderizar();
}

// Hacer la función global para que funcione el onclick
window.handleEliminar = handleEliminar;

// Eliminar todos los sorteos con confirmación
async function deleteAllSorteos() {
    if (!confirm('¿Estás seguro de que deseas eliminar TODOS los sorteos? Esta acción no se puede deshacer.')) return;

    // Vaciar en memoria
    balotas = [];

    // Guardar el archivo vacío y recalcular vistas
    await guardarDatos();
    recalcularRepetidas(false);
    renderizar();

    alert('✅ Todos los sorteos han sido eliminados');
}

window.deleteAllSorteos = deleteAllSorteos;

// Formulario
document.getElementById('form-balota').addEventListener('submit', (e) => {
    e.preventDefault();

    const balota1 = parseInt(document.getElementById('balota1').value);
    const balota2 = parseInt(document.getElementById('balota2').value);
    const balota3 = parseInt(document.getElementById('balota3').value);
    const balota4 = parseInt(document.getElementById('balota4').value);
    const balota5 = parseInt(document.getElementById('balota5').value);
    const superBalota = parseInt(document.getElementById('superBalota').value);
    const fechaSorteo = document.getElementById('fechaSorteo').value;

    // Validar rangos
    if (balota1 < 1 || balota1 > 43 || balota2 < 1 || balota2 > 43 || 
        balota3 < 1 || balota3 > 43 || balota4 < 1 || balota4 > 43 || 
        balota5 < 1 || balota5 > 43) {
        alert('⚠️ Las balotas principales deben estar entre 1 y 43');
        return;
    }

    if (superBalota < 1 || superBalota > 16) {
        alert('⚠️ La super balota debe estar entre 1 y 16');
        return;
    }

    // Validar que los números sean diferentes
    const numeros = [balota1, balota2, balota3, balota4, balota5];
    const numerosUnicos = new Set(numeros);
    
    if (numerosUnicos.size !== 5) {
        alert('⚠️ Las balotas principales deben ser números diferentes');
        return;
    }

    // Agregar la nueva balota
    const nuevaBalota = {
        balota_1: balota1,
        balota_2: balota2,
        balota_3: balota3,
        balota_4: balota4,
        balota_5: balota5,
        super_balota: superBalota,
        fecha_sorteo: fechaSorteo
    };

    const balotaAgregada = agregarBalota(nuevaBalota);
    if (!balotaAgregada) {
        // agregarBalota ya muestra un mensaje de por qué no se agregó
        return;
    }

    // Mostrar mensaje
    if (balotaAgregada.repetida) {
        alert('🎉 ¡Combinación agregada! Esta combinación ya había salido antes.');
    } else {
        alert('✅ ¡Combinación agregada exitosamente!');
    }

    // Limpiar formulario
    e.target.reset();
    
    // Renderizar las vistas
    renderizar();

    // Scroll a la sección de sorteos
    document.getElementById('section1').scrollIntoView({ behavior: 'smooth' });
});

// Establecer fecha de hoy por defecto
document.getElementById('fechaSorteo').valueAsDate = new Date();

// Inicializar la aplicación cargando datos del servidor
async function inicializarApp() {
    console.log('🎱 Iniciando aplicación de lotería...');
    balotas = await cargarDatos();
    console.log(`📊 ${balotas.length} combinaciones cargadas desde balotas.json`);
    
    // Recalcular repetidas sin guardar (los datos ya vienen del archivo)
    recalcularRepetidas(false);
    
    // Renderizar la interfaz
    renderizar();
    console.log('✅ Aplicación lista');
}

// Iniciar la aplicación
inicializarApp();
