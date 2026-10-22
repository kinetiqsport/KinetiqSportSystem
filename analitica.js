/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// analitica.js - Vista de analítica del dashboard (KPIs, gráficos y exportación CSV)

(function() {
    const CHART_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    const CHART_JS_SRI = 'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD';

    // Paleta categórica validada (CVD y contraste) para fondo claro
    const COLORES = {
        serie: ['#0A94B0', '#eb6834', '#6250d6', '#c2407a'],
        neutro: '#8A989F',
        grid: '#E9EEF1',
        texto: '#5B6B73'
    };
    const COLOR_PROFESIONAL = { Jorge: '#0A94B0', Santiago: '#eb6834', Mariana: '#6250d6', Nataly: '#c2407a' };
    const FUENTES = [
        { key: 'redes_sociales', label: 'Redes sociales', color: '#0A94B0' },
        { key: 'referido_por', label: 'Referidos', color: '#eb6834' },
        { key: 'charlas_informativas', label: 'Charlas informativas', color: '#6250d6' },
        { key: 'otro', label: 'Otros', color: COLORES.neutro }
    ];
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const RANGOS_EDAD = [
        { label: '60+', min: 60, max: 200 },
        { label: '45–59', min: 45, max: 59 },
        { label: '30–44', min: 30, max: 44 },
        { label: '18–29', min: 18, max: 29 },
        { label: '0–17', min: 0, max: 17 }
    ];

    const state = { charts: {}, chartJsPromise: null, ultimoFiltrado: [] };

    function cargarChartJs() {
        if (window.Chart) return Promise.resolve();
        if (state.chartJsPromise) return state.chartJsPromise;
        state.chartJsPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = CHART_JS_URL;
            s.integrity = CHART_JS_SRI;
            s.crossOrigin = 'anonymous';
            s.onload = () => {
                window.Chart.defaults.font.family = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
                resolve();
            };
            s.onerror = () => { state.chartJsPromise = null; reject(new Error('No se pudo cargar la librería de gráficos')); };
            document.head.appendChild(s);
        });
        return state.chartJsPromise;
    }

    // ---------- Acceso a datos ----------
    function json(r) {
        let v = r && r.reporte_json;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
        return v || {};
    }
    function fecha(r) {
        const d = new Date(r.fecha_creacion || r.fecha_modificacion);
        return isNaN(d.getTime()) ? null : d;
    }
    function tipo(r) { return r.tipo_reporte || 'pisada'; }
    function atendidoPor(r) {
        const j = json(r);
        const v = (r.atendido_por || j.atendidoPor || j.atendido_por || '').toString().trim();
        if (!v) return tipo(r) === 'piso_pelvico' ? Kinetiq.PROFESIONALES.piso_pelvico[0] : null;
        return Kinetiq.todosLosProfesionales().find(p => p.toLowerCase() === v.toLowerCase()) || v;
    }
    function sexo(r) {
        const s = (json(r).sexo || '').toString().toLowerCase().trim();
        if (['masculino', 'm', 'hombre'].includes(s)) return 'M';
        if (['femenino', 'f', 'mujer'].includes(s)) return 'F';
        return null;
    }

    // ---------- Rango de fechas ----------
    function inicioMes(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
    function rangoSeleccionado() {
        const preset = document.getElementById('anRango').value;
        const hoy = new Date();
        const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);
        let desde = null, hasta = finHoy;
        if (preset === 'mes') desde = inicioMes(hoy);
        else if (preset === '3m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        else if (preset === '12m') desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
        else if (preset === 'anio') desde = new Date(hoy.getFullYear(), 0, 1);
        else if (preset === 'custom') {
            const d = document.getElementById('anDesde').value;
            const h = document.getElementById('anHasta').value;
            desde = d ? new Date(d + 'T00:00:00') : null;
            hasta = h ? new Date(h + 'T23:59:59') : finHoy;
        }
        return { desde, hasta, preset };
    }
    function filtrar(reportes, desde, hasta, modulo) {
        return reportes.filter(r => {
            if (modulo !== 'todos' && tipo(r) !== modulo) return false;
            const f = fecha(r);
            if (!f) return !desde;
            if (desde && f < desde) return false;
            if (hasta && f > hasta) return false;
            return true;
        });
    }
    function mesesDelRango(reportes, desde, hasta) {
        let ini = desde ? inicioMes(desde) : null;
        if (!ini) {
            const fechas = reportes.map(fecha).filter(Boolean);
            ini = fechas.length ? inicioMes(new Date(Math.min(...fechas))) : inicioMes(new Date());
        }
        const fin = inicioMes(hasta || new Date());
        const meses = [];
        for (let d = new Date(ini); d <= fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
            meses.push(new Date(d));
        }
        return meses.slice(-36);
    }

    // ---------- Render ----------
    function setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }

    function renderKpis(filtrado, anterior, hayAnterior) {
        setText('anKpiTotal', filtrado.length);
        const delta = document.getElementById('anKpiTotalDelta');
        if (hayAnterior && anterior.length > 0) {
            const pct = Math.round(((filtrado.length - anterior.length) / anterior.length) * 100);
            delta.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs. período anterior (${anterior.length})`;
            delta.className = 'an-kpi-delta ' + (pct >= 0 ? 'up' : 'down');
        } else {
            delta.textContent = hayAnterior ? 'Sin datos del período anterior' : 'Todo el histórico';
            delta.className = 'an-kpi-delta';
        }

        setText('anKpiPacientes', new Set(filtrado.map(r => String(r.cedula || r.id))).size);
        const pelvicos = filtrado.filter(r => tipo(r) === 'piso_pelvico').length;
        setText('anKpiPacientesSub', `${filtrado.length - pelvicos} fisio · ${pelvicos} piso pélvico`);

        const evas = filtrado.map(r => parseInt(json(r).escalaDolor, 10)).filter(v => v >= 1 && v <= 10);
        setText('anKpiDolor', evas.length ? (evas.reduce((a, b) => a + b, 0) / evas.length).toFixed(1) : '–');
        setText('anKpiDolorSub', evas.length ? `EVA promedio · ${evas.length} valoraciones` : 'Sin registros de EVA');

        const edades = filtrado.map(r => parseInt(json(r).edad, 10)).filter(v => v > 0 && v < 120);
        setText('anKpiEdad', edades.length ? Math.round(edades.reduce((a, b) => a + b, 0) / edades.length) : '–');
        setText('anKpiEdadSub', edades.length ? 'Edad promedio (años)' : 'Sin registros de edad');
    }

    const baseOpciones = () => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
            legend: {
                position: 'top',
                align: 'start',
                labels: { usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10, color: COLORES.texto, font: { size: 12 } }
            },
            tooltip: {
                backgroundColor: '#0F1A1F',
                padding: 10,
                cornerRadius: 8,
                titleFont: { weight: '700' },
                displayColors: true,
                boxPadding: 4
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: COLORES.texto }, border: { color: COLORES.grid } },
            y: { beginAtZero: true, grid: { color: COLORES.grid }, ticks: { color: COLORES.texto, precision: 0 }, border: { display: false } }
        }
    });

    function dibujar(id, config) {
        if (state.charts[id]) state.charts[id].destroy();
        const canvas = document.getElementById(id);
        if (!canvas) return;
        state.charts[id] = new Chart(canvas, config);
    }

    function renderTendencia(todos, filtrado, rango, modulo) {
        const meses = mesesDelRango(filtrado, rango.desde, rango.hasta);
        const clave = d => `${d.getFullYear()}-${d.getMonth()}`;
        const actual = {}, previo = {};
        filtrado.forEach(r => { const f = fecha(r); if (f) actual[clave(f)] = (actual[clave(f)] || 0) + 1; });
        todos.forEach(r => {
            if (modulo !== 'todos' && tipo(r) !== modulo) return;
            const f = fecha(r);
            if (f) { const k = `${f.getFullYear() + 1}-${f.getMonth()}`; previo[k] = (previo[k] || 0) + 1; }
        });
        const etiquetas = meses.map(d => `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
        const opciones = baseOpciones();
        opciones.interaction = { mode: 'index', intersect: false };
        dibujar('anChartTendencia', {
            type: 'line',
            data: {
                labels: etiquetas,
                datasets: [
                    { label: 'Período seleccionado', data: meses.map(d => actual[clave(d)] || 0), borderColor: '#0A94B0', backgroundColor: 'rgba(10,148,176,0.10)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 3, pointHoverRadius: 6 },
                    { label: 'Mismo mes, año anterior', data: meses.map(d => previo[clave(d)] || 0), borderColor: COLORES.neutro, borderDash: [6, 5], borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: false, tension: 0.35 }
                ]
            },
            options: opciones
        });
    }

    function renderFuentes(filtrado) {
        const conteo = {};
        FUENTES.forEach(f => { conteo[f.key] = 0; });
        filtrado.forEach(r => { const k = json(r).comoNosConociste; if (k in conteo) conteo[k]++; });
        const total = Object.values(conteo).reduce((a, b) => a + b, 0);
        setText('anFuentesTotal', total);

        const leyenda = document.getElementById('anFuentesLeyenda');
        leyenda.innerHTML = FUENTES.map(f => {
            const pct = total ? Math.round((conteo[f.key] / total) * 100) : 0;
            return `<li><span class="an-swatch" style="background:${f.color}"></span><span>${f.label}</span><b>${conteo[f.key]}</b><em>${pct}%</em></li>`;
        }).join('');

        const opciones = baseOpciones();
        delete opciones.scales;
        opciones.plugins.legend = { display: false };
        opciones.cutout = '68%';
        dibujar('anChartFuentes', {
            type: 'doughnut',
            data: {
                labels: FUENTES.map(f => f.label),
                datasets: [{ data: FUENTES.map(f => conteo[f.key]), backgroundColor: FUENTES.map(f => f.color), borderColor: '#fff', borderWidth: 2, hoverOffset: 6 }]
            },
            options: opciones
        });
    }

    function renderReferidos(filtrado, referidosMap) {
        const conteo = {};
        filtrado.forEach(r => {
            const j = json(r);
            if (j.comoNosConociste === 'referido_por' && j.referidoSeleccionado) {
                conteo[j.referidoSeleccionado] = (conteo[j.referidoSeleccionado] || 0) + 1;
            }
        });
        const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const cont = document.getElementById('anReferidos');
        if (!top.length) {
            cont.innerHTML = '<div class="an-empty">No hay pacientes referidos en este período.</div>';
            return;
        }
        const max = top[0][1];
        cont.innerHTML = top.map(([id, n], i) => {
            const nombre = referidosMap[id] || 'Referido sin nombre';
            return `
                <div class="an-rank-row" title="${Kinetiq.escapeHtml(nombre)}: ${n} paciente${n === 1 ? '' : 's'}">
                    <span class="an-rank-pos">${i + 1}</span>
                    <span class="an-rank-name">${Kinetiq.escapeHtml(nombre)}</span>
                    <span class="an-rank-bar"><span style="width:${Math.max(4, Math.round((n / max) * 100))}%"></span></span>
                    <b class="an-rank-val">${n}</b>
                </div>`;
        }).join('');
    }

    function renderProfesionales(filtrado, rango) {
        const meses = mesesDelRango(filtrado, rango.desde, rango.hasta).slice(-12);
        const clave = d => `${d.getFullYear()}-${d.getMonth()}`;
        const profs = Kinetiq.todosLosProfesionales();
        const datos = {};
        profs.forEach(p => { datos[p] = {}; });
        filtrado.forEach(r => {
            const p = atendidoPor(r), f = fecha(r);
            if (p && f && datos[p]) datos[p][clave(f)] = (datos[p][clave(f)] || 0) + 1;
        });
        const opciones = baseOpciones();
        opciones.scales.x.stacked = true;
        opciones.scales.y.stacked = true;
        opciones.interaction = { mode: 'index', intersect: false };
        dibujar('anChartProfesionales', {
            type: 'bar',
            data: {
                labels: meses.map(d => `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`),
                datasets: profs.map((p, i) => ({
                    label: p,
                    data: meses.map(d => datos[p][clave(d)] || 0),
                    backgroundColor: COLOR_PROFESIONAL[p] || COLORES.serie[i % COLORES.serie.length],
                    borderColor: '#fff',
                    borderWidth: { top: 2 },
                    borderRadius: 4,
                    borderSkipped: false,
                    maxBarThickness: 34
                }))
            },
            options: opciones
        });
    }

    function renderPiramide(filtrado) {
        const hombres = RANGOS_EDAD.map(() => 0), mujeres = RANGOS_EDAD.map(() => 0);
        filtrado.forEach(r => {
            const e = parseInt(json(r).edad, 10), s = sexo(r);
            if (!(e >= 0) || !s) return;
            const i = RANGOS_EDAD.findIndex(g => e >= g.min && e <= g.max);
            if (i < 0) return;
            if (s === 'M') hombres[i]++; else mujeres[i]++;
        });
        const max = Math.max(1, ...hombres, ...mujeres);
        const opciones = baseOpciones();
        opciones.indexAxis = 'y';
        opciones.scales.x = {
            stacked: true, min: -max, max: max,
            grid: { color: COLORES.grid }, border: { display: false },
            ticks: { color: COLORES.texto, precision: 0, callback: v => Math.abs(v) }
        };
        opciones.scales.y = { stacked: true, grid: { display: false }, ticks: { color: COLORES.texto }, border: { color: COLORES.grid } };
        opciones.plugins.tooltip.callbacks = { label: ctx => `${ctx.dataset.label}: ${Math.abs(ctx.raw)}` };
        dibujar('anChartPiramide', {
            type: 'bar',
            data: {
                labels: RANGOS_EDAD.map(g => g.label),
                datasets: [
                    { label: 'Masculino', data: hombres.map(v => -v), backgroundColor: '#0A94B0', borderRadius: 4, borderSkipped: false, maxBarThickness: 26 },
                    { label: 'Femenino', data: mujeres, backgroundColor: '#c2407a', borderRadius: 4, borderSkipped: false, maxBarThickness: 26 }
                ]
            },
            options: opciones
        });
    }

    // ---------- Exportación ----------
    function exportarCSV() {
        const filas = state.ultimoFiltrado;
        const referidosMap = (window.reportesViewer && window.reportesViewer.referidosMap) || {};
        const cols = ['Fecha', 'Tipo', 'Cédula', 'Nombre', 'Apellido', 'Edad', 'Sexo', 'Atendido por', 'Cómo nos conoció', 'Referido', 'Deporte', 'Localización del dolor', 'EVA'];
        const fuente = Object.fromEntries(FUENTES.map(f => [f.key, f.label]));
        const esc = v => {
            let s = String(v ?? '');
            if (/^[=+\-@]/.test(s)) s = "'" + s; // Evita fórmulas al abrir en Excel
            return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const lineas = [cols.join(';')];
        filas.forEach(r => {
            const j = json(r), f = fecha(r);
            lineas.push([
                f ? f.toISOString().slice(0, 10) : '',
                tipo(r) === 'piso_pelvico' ? 'Piso pélvico' : 'Fisioterapia deportiva',
                r.cedula, r.nombre, r.apellido, j.edad, j.sexo, atendidoPor(r) || '',
                fuente[j.comoNosConociste] || j.comoNosConociste || '',
                j.referidoSeleccionado ? (referidosMap[j.referidoSeleccionado] || '') : '',
                j.deporte, j.localizacionDolor, j.escalaDolor
            ].map(esc).join(';'));
        });
        const hoy = new Date().toISOString().slice(0, 10);
        Kinetiq.descargarArchivo('﻿' + lineas.join('\r\n'), `Kinetiq_reportes_${hoy}.csv`, 'text/csv;charset=utf-8');
    }

    // ---------- Orquestación ----------
    async function actualizar() {
        const viewer = window.reportesViewer;
        const todos = (viewer && viewer.allReportes) || [];
        const modulo = document.getElementById('anModulo').value;
        const rango = rangoSeleccionado();
        document.getElementById('anFechasCustom').style.display = rango.preset === 'custom' ? 'flex' : 'none';

        const filtrado = filtrar(todos, rango.desde, rango.hasta, modulo);
        state.ultimoFiltrado = filtrado;

        let anterior = [], hayAnterior = false;
        if (rango.desde) {
            const dur = rango.hasta - rango.desde;
            const hastaAnt = new Date(rango.desde.getTime() - 1);
            anterior = filtrar(todos, new Date(hastaAnt.getTime() - dur), hastaAnt, modulo);
            hayAnterior = true;
        }
        renderKpis(filtrado, anterior, hayAnterior);
        setText('anExportCount', filtrado.length);

        const estado = document.getElementById('anEstado');
        try {
            await cargarChartJs();
            estado.textContent = '';
            renderTendencia(todos, filtrado, rango, modulo);
            renderFuentes(filtrado);
            renderReferidos(filtrado, (viewer && viewer.referidosMap) || {});
            renderProfesionales(filtrado, rango);
            renderPiramide(filtrado);
        } catch (e) {
            estado.textContent = 'No se pudieron cargar los gráficos. Revisa tu conexión a internet.';
        }
    }

    function init() {
        if (!document.getElementById('analyticsView')) return;
        ['anRango', 'anModulo', 'anDesde', 'anHasta'].forEach(id => {
            document.getElementById(id).addEventListener('change', actualizar);
        });
        document.getElementById('anExportar').addEventListener('click', exportarCSV);
    }

    // La página de reportes llama a mostrar() al abrir la pestaña "Analítica";
    // refrescar() vuelve a dibujar si llegan datos nuevos mientras está visible
    window.KinetiqAnalitica = {
        mostrar() {
            actualizar();
        },
        refrescar() {
            const view = document.getElementById('analyticsView');
            if (view && view.classList.contains('open')) actualizar();
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
