/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// auth-guard.js - Verificación y protección centralizada de sesión con Supabase

(function() {
    // Limpiar caché clínica antigua: antes se guardaba en localStorage y sobrevivía al cerrar el navegador
    try { localStorage.removeItem('preloadedReportes'); } catch (e) {}

    // Si estamos en modo demostración/portafolio, permitir navegación para el showcase de LinkedIn
    if (sessionStorage.getItem('demoMode') === 'true') {
        window.logout = function() {
            sessionStorage.clear();
            window.location.href = 'demo.html';
        };
        window.secureLogout = window.logout;
        return;
    }

    // 1. Verificación inmediata en sessionStorage para evitar parpadeos de UI
    const isLocalLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLocalLoggedIn) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Verificación criptográfica con Supabase
    async function verifySupabaseSession() {
        let attempts = 0;
        while ((!window.supabaseClient || !window.supabaseClient.supabase) && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 150));
            attempts++;
        }

        if (!window.supabaseClient || !window.supabaseClient.supabase) {
            console.warn('AuthGuard: Cliente Supabase no disponible para verificación');
            return;
        }

        try {
            const { data: { session }, error } = await window.supabaseClient.supabase.auth.getSession();
            if (error || !session) {
                console.warn('AuthGuard: Sesión de Supabase inválida o expirada');
                await secureLogout();
                return;
            }

            // Escuchar cambios de estado de autenticación (ej. cierre de sesión o token revocado)
            window.supabaseClient.supabase.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_OUT') {
                    secureLogout();
                }
            });
        } catch (err) {
            console.error('AuthGuard: Error validando sesión:', err);
        }
    }

    // 3. Logout seguro: revoca sesión en Supabase y limpia almacenamiento sensible
    async function secureLogout(motivo) {
        try {
            if (window.supabaseClient?.supabase) {
                await window.supabaseClient.supabase.auth.signOut();
            }
        } catch (e) {
            console.warn('Error al hacer signOut en Supabase:', e);
        }
        sessionStorage.clear();
        localStorage.removeItem('preloadedReportes');
        window.location.href = motivo === 'inactividad' ? 'login.html?motivo=inactividad' : 'login.html';
    }

    // 4. Temporizador de inactividad (45 minutos) para proteger equipos y tablets compartidas
    let inactivityTimer;
    const INACTIVITY_LIMIT_MS = 45 * 60 * 1000;

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
            console.warn('AuthGuard: Sesión cerrada por inactividad prolongada (45 min)');
            secureLogout('inactividad');
        }, INACTIVITY_LIMIT_MS);
    }

    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });
    resetInactivityTimer();

    // Exponer funciones globalmente
    window.logout = secureLogout;
    window.secureLogout = secureLogout;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', verifySupabaseSession);
    } else {
        verifySupabaseSession();
    }
})();

