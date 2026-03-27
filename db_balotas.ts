
// Definición de tipos para la base de datos de balotas
// Este archivo solo contiene las definiciones de tipos TypeScript
// La implementación real está en app.js

interface Balota {
    id: string;
    balota_1: number;
    balota_2: number;
    balota_3: number;
    balota_4: number;
    balota_5: number;
    super_balota: number;
    fecha_sorteo: string;
    repetida: boolean;
    cantidad_repeticiones: number;
    repetida_con_super?: boolean;
    cantidad_repeticiones_con_super?: number;
}