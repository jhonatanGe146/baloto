const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const BALOTAS_FILE = path.join(__dirname, 'balotas.json');

// Middleware
app.use(cors());
// Aumentar límite de tamaño del body para permitir grandes payloads JSON
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// Inicializar archivo si no existe
async function inicializarArchivo() {
    try {
        await fs.access(BALOTAS_FILE);
    } catch {
        // Si no existe, crear con datos de ejemplo
        const datosIniciales = [
            {
                id: "1",
                balota_1: 5,
                balota_2: 12,
                balota_3: 23,
                balota_4: 34,
                balota_5: 42,
                super_balota: 8,
                fecha_sorteo: "2024-01-15",
                repetida: false,
                cantidad_repeticiones: 0
            },
            {
                id: "2",
                balota_1: 3,
                balota_2: 17,
                balota_3: 25,
                balota_4: 31,
                balota_5: 45,
                super_balota: 12,
                fecha_sorteo: "2024-01-22",
                repetida: false,
                cantidad_repeticiones: 0
            },
            {
                id: "3",
                balota_1: 5,
                balota_2: 12,
                balota_3: 23,
                balota_4: 34,
                balota_5: 42,
                super_balota: 8,
                fecha_sorteo: "2024-02-10",
                repetida: true,
                cantidad_repeticiones: 1
            }
        ];
        await fs.writeFile(BALOTAS_FILE, JSON.stringify(datosIniciales, null, 2));
        console.log('✅ Archivo balotas.json creado con datos de ejemplo');
    }
}

// Leer todas las balotas
app.get('/api/balotas', async (req, res) => {
    try {
        const data = await fs.readFile(BALOTAS_FILE, 'utf8');
        const balotas = JSON.parse(data);
        console.log(`📖 Cargadas ${balotas.length} combinaciones desde balotas.json`);
        res.json(balotas);
    } catch (error) {
        console.error('Error al leer balotas:', error);
        res.status(500).json({ error: 'Error al leer datos' });
    }
});

// Guardar todas las balotas
app.post('/api/balotas', async (req, res) => {
    try {
        const balotas = req.body;
        await fs.writeFile(BALOTAS_FILE, JSON.stringify(balotas, null, 2));
        console.log(`💾 Guardadas ${balotas.length} combinaciones en balotas.json`);
        res.json({ success: true, message: 'Datos guardados exitosamente' });
    } catch (error) {
        console.error('Error al guardar balotas:', error);
        res.status(500).json({ error: 'Error al guardar datos' });
    }
});

// Agregar una balota
app.post('/api/balotas/agregar', async (req, res) => {
    try {
        const data = await fs.readFile(BALOTAS_FILE, 'utf8');
        const balotas = JSON.parse(data);
        
        const nuevaBalota = req.body;
        balotas.push(nuevaBalota);
        
        await fs.writeFile(BALOTAS_FILE, JSON.stringify(balotas, null, 2));
        res.json({ success: true, balota: nuevaBalota });
    } catch (error) {
        console.error('Error al agregar balota:', error);
        res.status(500).json({ error: 'Error al agregar balota' });
    }
});

// Eliminar una balota
app.delete('/api/balotas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await fs.readFile(BALOTAS_FILE, 'utf8');
        let balotas = JSON.parse(data);
        
        balotas = balotas.filter(b => b.id !== id);
        
        await fs.writeFile(BALOTAS_FILE, JSON.stringify(balotas, null, 2));
        res.json({ success: true, message: 'Balota eliminada' });
    } catch (error) {
        console.error('Error al eliminar balota:', error);
        res.status(500).json({ error: 'Error al eliminar balota' });
    }
});

// Iniciar servidor
async function iniciarServidor() {
    await inicializarArchivo();
    app.listen(PORT, () => {
        console.log('🎱 ========================================');
        console.log(`🎱 Servidor de Lotería del Pueblo iniciado`);
        console.log(`🎱 URL: http://localhost:${PORT}`);
        console.log(`🎱 Archivo de datos: balotas.json`);
        console.log('🎱 ========================================');
        console.log('');
        console.log('📝 Presiona Ctrl+C para detener el servidor');
    });
}

iniciarServidor().catch(console.error);
