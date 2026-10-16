/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// Importar librería oficial de Supabase
let createClient = null;

const SUPABASE_CONFIG = {
    url: 'https://adisallqgbylyffrvhzs.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || ''
};

// Cargar la librería del CDN de forma controlada
function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        // Verificar si ya está cargada
        if (window.supabase?.createClient) {
            resolve();
            return;
        }
        
        // Crear script tag
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            console.log('✓ Librería Supabase cargada del CDN');
            resolve();
        };
        script.onerror = () => {
            console.error('❌ Error cargando librería Supabase del CDN');
            reject(new Error('No se pudo cargar Supabase del CDN'));
        };
        document.head.appendChild(script);
    });
}

// La librería se carga desde el CDN, se debe esperar a que esté lista
// El CDN carga a window.supabase.createClient

class SupabaseClient {
    constructor() {
        try {
            // La librería del CDN expone createClient en window.supabase
            if (!window.supabase || !window.supabase.createClient) {
                throw new Error('Supabase.createClient no disponible en window.supabase');
            }
            
            this.supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('✓ Supabase conectado correctamente');
        } catch (error) {
            console.error('Error inicializando Supabase:', error);
            this.supabase = null;
        }
    }

    async getCurrentUserEmail() {
        try {
            if (this.supabase && this.supabase.auth) {
                const { data } = await this.supabase.auth.getSession();
                if (data?.session?.user?.email) return data.session.user.email;
            }
        } catch (e) {
            console.warn('No se pudo obtener email de sesión Supabase:', e);
        }
        return sessionStorage.getItem('userEmail') || null;
    }

    async saveReporte(data) {
        try {
            const userEmail = await this.getCurrentUserEmail();
            if (userEmail) {
                if (!data.creado_por) data.creado_por = userEmail;
                data.modificado_por = userEmail;
                if (data.reporte_json && typeof data.reporte_json === 'object') {
                    data.reporte_json.creado_por = data.creado_por;
                    data.reporte_json.modificado_por = data.modificado_por;
                }
            }

            const { data: result, error } = await this.supabase
                .from('reportes')
                .insert([data])
                .select();
            
            // Si alguna columna física opcional no existe en la BD (PGRST204 o 42703), reintentar sin ellas
            if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('column')))) {
                console.warn('Columnas opcionales (atendido_por/creado_por/modificado_por) no existen en tabla SQL, guardando sólo columnas base y preservando todo en reporte_json');
                const dataFallback = { ...data };
                delete dataFallback.creado_por;
                delete dataFallback.modificado_por;
                delete dataFallback.atendido_por;
                const retry = await this.supabase
                    .from('reportes')
                    .insert([dataFallback])
                    .select();
                if (retry.error) throw retry.error;
                return retry.data?.[0] || null;
            }

            if (error) throw error;
            return result?.[0] || null;
        } catch (error) {
            console.error('Error guardando reporte:', error);
            throw error;
        }
    }

    async updateReporte(cedula, data, tipo) {
        try {
            const userEmail = await this.getCurrentUserEmail();
            if (userEmail) {
                data.modificado_por = userEmail;
                if (data.reporte_json && typeof data.reporte_json === 'object') {
                    data.reporte_json.modificado_por = userEmail;
                }
            }

            let query = this.supabase
                .from('reportes')
                .update(data)
                .eq('cedula', cedula);
            
            if (tipo) {
                query = query.eq('tipo_reporte', tipo);
            }
            
            const { data: result, error } = await query.select();
            
            // Si alguna columna física opcional no existe en la BD (PGRST204 o 42703), reintentar sin ellas
            if (error && (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('column')))) {
                console.warn('Columnas opcionales no existen en tabla SQL, actualizando sólo columnas base');
                const dataFallback = { ...data };
                delete dataFallback.creado_por;
                delete dataFallback.modificado_por;
                delete dataFallback.atendido_por;
                let retryQuery = this.supabase
                    .from('reportes')
                    .update(dataFallback)
                    .eq('cedula', cedula);
                if (tipo) {
                    retryQuery = retryQuery.eq('tipo_reporte', tipo);
                }
                const retry = await retryQuery.select();
                if (retry.error) throw retry.error;
                return retry.data?.[0] || null;
            }

            if (error) throw error;
            return result?.[0] || null;
        } catch (error) {
            console.error('Error actualizando reporte:', error);
            throw error;
        }
    }

    async getReporteByCedula(cedula) {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('*')
                .eq('cedula', cedula);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error buscando reporte:', error);
            throw error;
        }
    }

    async getReporteByCedulaTipo(cedula, tipo) {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('*')
                .eq('cedula', cedula)
                .eq('tipo_reporte', tipo)
                .maybeSingle();
            
            if (error && error.code !== 'PGRST116') throw error;
            return data || null;
        } catch (error) {
            console.error('Error buscando reporte por tipo:', error);
            throw error;
        }
    }

    async getAllReportes() {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('id, cedula, nombre, apellido, tipo_reporte, fecha_creacion, fecha_modificacion, reporte_json, tipo_archivo_adjunto')
                .order('fecha_modificacion', { ascending: false })
                .limit(500);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error listando reportes:', error);
            throw error;
        }
    }

    async getReporteById(id) {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error obteniendo reporte:', error);
            throw error;
        }
    }

    async getReportesSources(limit = 500) {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('id, reporte_json->>comoNosConociste, reporte_json->>referidoSeleccionado')
                .order('fecha_modificacion', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            console.log('✓ Sources data loaded:', data?.length, data?.slice(0,3));
            return data || [];
        } catch (error) {
            console.error('Error obteniendo fuentes de reportes:', error);
            return []; // Return empty instead of throwing to not block UI
        }
    }

    async searchReportes(query, limit = 100) {
        try {
            const { data, error } = await this.supabase
                .from('reportes')
                .select('id, cedula, nombre, apellido, tipo_reporte, fecha_creacion, fecha_modificacion, archivo_adjunto, tipo_archivo_adjunto')
                .or(`nombre.ilike.%${query}%,apellido.ilike.%${query}%,cedula.ilike.%${query}%`)
                .order('fecha_modificacion', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error buscando reportes:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (error || !user) {
                console.warn('No hay usuario autenticado:', error);
                return null;
            }
            return user;
        } catch (error) {
            console.error('Error obteniendo usuario:', error);
            return null;
        }
    }

    async getReferidos() {
        try {
            const { data, error } = await this.supabase
                .from('referidos')
                .select('*')
                .eq('activo', true)
                .order('nombre');
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error obteniendo referidos:', error);
            return [];
        }
    }

    async saveReferido(referido) {
        try {
            const { data, error } = await this.supabase
                .from('referidos')
                .insert([referido])
                .select();
            
            if (error) throw error;
            return data?.[0] || null;
        } catch (error) {
            console.error('Error guardando referido:', error);
            throw error;
        }
    }

    async updateReferido(id, referido) {
        try {
            const { data, error } = await this.supabase
                .from('referidos')
                .update(referido)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return data?.[0] || null;
        } catch (error) {
            console.error('Error actualizando referido:', error);
            throw error;
        }
    }

    async deleteReferido(id) {
        try {
            const { error } = await this.supabase
                .from('referidos')
                .update({ activo: false })
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error eliminando referido:', error);
            throw error;
        }
    }
}

// Instancia global con delay para asegurar carga de librería
async function initSupabaseClient() {
    try {
        // Cargar la librería del CDN primero
        await loadSupabaseLibrary();
        
        // Verificar que createClient esté disponible en window.supabase
        if (!window.supabase?.createClient) {
            console.error('❌ window.supabase.createClient no disponible después de cargar CDN');
            setTimeout(initSupabaseClient, 500);
            return;
        }
        
        if (window.supabaseClient) {
            return; // Ya está inicializado
        }
        
        window.supabaseClient = new SupabaseClient();
    } catch (error) {
        console.error('❌ Error inicializando SupabaseClient:', error);
        setTimeout(initSupabaseClient, 1000);
    }
}

// Esperar a que el DOM esté listo Y que la librería esté cargada
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initSupabaseClient();
    });
} else {
    initSupabaseClient();
}
