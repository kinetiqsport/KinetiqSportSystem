/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// exportar-xlsx.js - Exporta valoraciones a un Excel (.xlsx) con formato:
//   · Hoja "Resumen": KPIs, gráficas y tablas con las cifras
//   · Hoja "Pacientes": una fila por valoración, con filtros, colores y escala de dolor
// Las librerías (ExcelJS y Chart.js) se descargan sólo cuando se pulsa exportar.
//
// Uso: KinetiqExcel.exportar({ filas, filtros: ['Dolor ≥ 5'], nombre: 'Kinetiq_valoraciones' })
// Cada fila: { fecha: Date, modulo: 'pisada'|'piso_pelvico', nombre, apellido, cedula, sexo, edad,
//              peso, celular, profesional, eva, zonas, detalle, fuente, fuenteDetalle, referido }

(function () {
    'use strict';

    const EXCELJS = {
        url: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
        sri: 'sha384-Pqp51FUN2/qzfxZxBCtF0stpc9ONI6MYZpVqmo8m20SoaQCzf+arZvACkLkirlPz'
    };
    const CHARTJS = {
        url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
        sri: 'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD'
    };

    // Paleta de Kinetiq (la misma de la analítica)
    const C = {
        teal: '0A94B0', tealDark: '075E70', ink: '0F1A1F', muted: '5B6B73', grid: 'E3EAEE',
        zebra: 'F5FAFB', card: 'EEF8FA', orange: 'EB6834', purple: '6250D6', magenta: 'C2407A',
        gray: '8A989F', white: 'FFFFFF'
    };
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const COLOR_PROFESIONAL = { Jorge: C.teal, Santiago: C.orange, Mariana: C.purple, Nataly: C.magenta };
    const COLORES_SERIE = [C.teal, C.orange, C.purple, C.gray, C.magenta];
    const MODULO = {
        pisada: { nombre: 'Fisio deportiva', largo: 'Fisioterapia deportiva', fondo: 'E2F4F8', texto: C.tealDark, color: C.teal },
        piso_pelvico: { nombre: 'Piso pélvico', largo: 'Piso pélvico', fondo: 'FBE8F1', texto: 'A3315F', color: C.magenta }
    };
    // Escala de dolor: verde (1) → amarillo (5) → rojo (10)
    const COLORES_EVA = ['5FBF8A', '7CCB86', '9AD582', 'B9DC7E', 'DCE07A', 'F2D56E', 'F5B95F', 'F29A55', 'EC7A4D', 'E5584A'];

    const argb = hex => 'FF' + hex;
    const relleno = hex => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } });
    const borde = (hex, style) => ({ style: style || 'thin', color: { argb: argb(hex) } });
    const fuente = (o) => Object.assign({ name: 'Calibri', size: 10, color: { argb: argb(C.ink) } }, o, o && o.color ? { color: { argb: argb(o.color) } } : {});

    // ---------- Carga de librerías ----------
    const cargas = {};
    function cargarScript(lib, listo) {
        if (listo()) return Promise.resolve();
        if (cargas[lib.url]) return cargas[lib.url];
        cargas[lib.url] = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = lib.url;
            s.integrity = lib.sri;
            s.crossOrigin = 'anonymous';
            s.onload = () => (listo() ? resolve() : reject(new Error('La librería no quedó disponible')));
            s.onerror = () => { delete cargas[lib.url]; reject(new Error('No se pudo descargar la librería de Excel. Revisa tu conexión.')); };
            document.head.appendChild(s);
        });
        return cargas[lib.url];
    }

    // ---------- Cifras del resumen ----------
    function contar(filas, clave) {
        const m = new Map();
        filas.forEach(f => { const k = clave(f); m.set(k, (m.get(k) || 0) + 1); });
        return m;
    }
    const ordenarDesc = m => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es'));

    function resumir(filas) {
        const promedio = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
        const evas = filas.map(f => f.eva).filter(v => typeof v === 'number' && v >= 1 && v <= 10);
        const edades = filas.map(f => f.edad).filter(v => typeof v === 'number' && v > 0 && v < 120);
        const pacientes = new Set(filas.map((f, i) => String(f.cedula || `fila-${i}`).trim())).size;
        const pelvicos = filas.filter(f => f.modulo === 'piso_pelvico').length;

        // Meses seguidos desde la primera hasta la última valoración (máx. 24)
        const fechas = filas.map(f => f.fecha).filter(d => d instanceof Date && !isNaN(d));
        const meses = [];
        if (fechas.length) {
            const llave = d => d.getFullYear() * 12 + d.getMonth();
            const min = Math.min(...fechas.map(llave)), max = Math.max(...fechas.map(llave));
            const cuenta = new Map();
            fechas.forEach(d => cuenta.set(llave(d), (cuenta.get(llave(d)) || 0) + 1));
            for (let k = Math.max(min, max - 23); k <= max; k++) {
                meses.push({ etiqueta: `${MESES[k % 12]} ${String(Math.floor(k / 12)).slice(2)}`, largo: `${MESES[k % 12]} ${Math.floor(k / 12)}`, n: cuenta.get(k) || 0 });
            }
        }

        const profesionales = ordenarDesc(contar(filas, f => f.profesional || 'Sin asignar'));
        const origenes = ordenarDesc(contar(filas, f => f.fuente || 'Sin dato'));
        const dolor = Array.from({ length: 10 }, (_, i) => evas.filter(v => Math.round(v) === i + 1).length);
        const sexos = contar(filas, f => f.sexo || '');

        return {
            total: filas.length, pacientes, pelvicos, fisio: filas.length - pelvicos,
            eva: promedio(evas), nEva: evas.length, edad: promedio(edades), nEdad: edades.length,
            mujeres: sexos.get('Femenino') || 0, hombres: sexos.get('Masculino') || 0,
            meses, profesionales, origenes, dolor
        };
    }

    // ---------- Gráficas (se dibujan fuera de pantalla y se incrustan como imagen) ----------
    const F = 20; // tamaño de letra en el lienzo; al incrustarse a la mitad queda en ~10 pt
    const css = hex => '#' + hex;

    function opcionesBase(titulo) {
        return {
            responsive: false, animation: false, devicePixelRatio: 1,
            layout: { padding: { top: 6, right: 22, bottom: 6, left: 8 } },
            plugins: {
                legend: { display: false },
                title: { display: true, text: titulo, align: 'start', color: css(C.ink), font: { size: 26, weight: '700' }, padding: { bottom: 18 } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: css(C.muted), font: { size: F } }, border: { color: css(C.grid) } },
                y: { beginAtZero: true, grid: { color: css(C.grid) }, ticks: { color: css(C.muted), precision: 0, font: { size: F } }, border: { display: false } }
            }
        };
    }
    const pluginFondo = {
        id: 'fondoBlanco',
        beforeDraw(chart) { const { ctx, width, height } = chart; ctx.save(); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); ctx.restore(); }
    };
    const pluginValores = {
        id: 'valoresEnBarras',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const horizontal = chart.options.indexAxis === 'y';
            chart.data.datasets.forEach((ds, di) => {
                chart.getDatasetMeta(di).data.forEach((barra, i) => {
                    const v = ds.data[i];
                    if (!v) return;
                    ctx.save();
                    ctx.fillStyle = css(C.ink);
                    ctx.font = `700 ${F}px ${window.Chart.defaults.font.family}`;
                    if (horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(v, barra.x + 10, barra.y); }
                    else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(v, barra.x, barra.y - 6); }
                    ctx.restore();
                });
            });
        }
    };
    const pluginCentro = {
        id: 'totalCentro',
        afterDraw(chart) {
            const arco = chart.getDatasetMeta(0).data[0];
            if (!arco) return;
            const { ctx } = chart;
            const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = css(C.ink);
            ctx.font = `800 52px ${window.Chart.defaults.font.family}`;
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(total, arco.x, arco.y + 8);
            ctx.fillStyle = css(C.muted);
            ctx.font = `600 ${F}px ${window.Chart.defaults.font.family}`;
            ctx.fillText('valoraciones', arco.x, arco.y + 38);
            ctx.restore();
        }
    };

    function aPNG(config, ancho, alto) {
        const canvas = document.createElement('canvas');
        canvas.width = ancho; canvas.height = alto;
        config.plugins = [pluginFondo].concat(config.plugins || []);
        const chart = new window.Chart(canvas, config);
        const b64 = canvas.toDataURL('image/png').split(',')[1];
        chart.destroy();
        return b64;
    }

    function graficas(r) {
        const W = 1048, H = 544;
        const salida = {};

        // 1. Valoraciones por mes
        if (r.meses.length) {
            const max = Math.max(1, ...r.meses.map(m => m.n));
            const o = opcionesBase('Valoraciones por mes');
            o.scales.y.suggestedMax = Math.ceil(max * 1.18);
            salida.mes = aPNG({
                type: 'bar',
                data: { labels: r.meses.map(m => m.etiqueta), datasets: [{ data: r.meses.map(m => m.n), backgroundColor: css(C.teal), borderRadius: 8, borderSkipped: false, maxBarThickness: 70 }] },
                options: o, plugins: [pluginValores]
            }, W, H);
        }

        // Los "sin dato" no se grafican (dominarían la imagen); se indican en el título y quedan en las tablas
        const conDato = (lista, vacio) => lista.filter(([k]) => k !== vacio);
        const sufijo = (lista, vacio) => {
            const con = conDato(lista, vacio).reduce((a, [, n]) => a + n, 0);
            return con < r.total ? ` · ${con} de ${r.total} con dato` : '';
        };
        const origenes = conDato(r.origenes, 'Sin dato');
        const profesionales = conDato(r.profesionales, 'Sin asignar');

        // 2. Origen de los pacientes (dona)
        if (origenes.length) {
            const total = origenes.reduce((a, [, n]) => a + n, 0);
            const o = opcionesBase('¿Cómo nos conocieron?' + sufijo(r.origenes, 'Sin dato'));
            delete o.scales;
            o.cutout = '62%';
            o.layout.padding = { top: 6, right: 12, bottom: 12, left: 12 };
            o.plugins.legend = {
                display: true, position: 'right',
                labels: { color: css(C.ink), font: { size: F }, boxWidth: 22, boxHeight: 22, padding: 18, usePointStyle: true, pointStyle: 'rectRounded' }
            };
            salida.origen = aPNG({
                type: 'doughnut',
                data: {
                    labels: origenes.map(([k, n]) => `${k} · ${n} (${Math.round(n * 100 / total)}%)`),
                    datasets: [{ data: origenes.map(([, n]) => n), backgroundColor: origenes.map((_, i) => css(COLORES_SERIE[i % COLORES_SERIE.length])), borderColor: '#ffffff', borderWidth: 5 }]
                },
                options: o, plugins: [pluginCentro]
            }, W, H);
        }

        // 3. Carga por profesional (barras horizontales)
        if (profesionales.length) {
            const max = Math.max(1, ...profesionales.map(([, n]) => n));
            const o = opcionesBase('Carga por profesional' + sufijo(r.profesionales, 'Sin asignar'));
            o.indexAxis = 'y';
            o.scales.x = { beginAtZero: true, suggestedMax: Math.ceil(max * 1.15), grid: { color: css(C.grid) }, ticks: { color: css(C.muted), precision: 0, font: { size: F } }, border: { display: false } };
            o.scales.y = { grid: { display: false }, ticks: { color: css(C.ink), font: { size: F } }, border: { color: css(C.grid) } };
            salida.profesional = aPNG({
                type: 'bar',
                data: {
                    labels: profesionales.map(([k]) => k),
                    datasets: [{ data: profesionales.map(([, n]) => n), backgroundColor: profesionales.map(([k], i) => css(COLOR_PROFESIONAL[k] || COLORES_SERIE[i % COLORES_SERIE.length])), borderRadius: 8, borderSkipped: false, maxBarThickness: 46 }]
                },
                options: o, plugins: [pluginValores]
            }, W, H);
        }

        // 4. Distribución del dolor (EVA)
        if (r.nEva) {
            const max = Math.max(1, ...r.dolor);
            const o = opcionesBase('Distribución del dolor (EVA 1–10)' + (r.nEva < r.total ? ` · ${r.nEva} de ${r.total} con dato` : ''));
            o.scales.y.suggestedMax = Math.ceil(max * 1.18);
            salida.dolor = aPNG({
                type: 'bar',
                data: { labels: r.dolor.map((_, i) => String(i + 1)), datasets: [{ data: r.dolor, backgroundColor: COLORES_EVA.map(css), borderRadius: 8, borderSkipped: false, maxBarThickness: 64 }] },
                options: o, plugins: [pluginValores]
            }, W, H);
        }
        return salida;
    }

    // ---------- Utilidades de hoja ----------
    // Aplica un estilo a todas las celdas de un rango (necesario en celdas combinadas)
    function pintar(ws, fila1, col1, fila2, col2, estilo) {
        for (let f = fila1; f <= fila2; f++) {
            for (let c = col1; c <= col2; c++) {
                const celda = ws.getCell(f, c);
                if (estilo.fill) celda.fill = estilo.fill;
                if (estilo.font) celda.font = estilo.font;
                if (estilo.alignment) celda.alignment = estilo.alignment;
                const b = {};
                if (estilo.border) {
                    if (estilo.border.top && f === fila1) b.top = estilo.border.top;
                    if (estilo.border.bottom && f === fila2) b.bottom = estilo.border.bottom;
                    if (estilo.border.left && c === col1) b.left = estilo.border.left;
                    if (estilo.border.right && c === col2) b.right = estilo.border.right;
                    if (Object.keys(b).length) celda.border = Object.assign({}, celda.border, b);
                }
            }
        }
    }
    function combinar(ws, fila, col1, col2, valor, estilo, numFmt) {
        if (col2 > col1) ws.mergeCells(fila, col1, fila, col2);
        const celda = ws.getCell(fila, col1);
        celda.value = valor;
        if (numFmt) celda.numFmt = numFmt;
        pintar(ws, fila, col1, fila, col2, estilo);
    }
    const fmtMiles = n => Number(n).toLocaleString('es-CO');

    // ---------- Hoja Resumen ----------
    function hojaResumen(wb, filas, r, imgs, opts) {
        const ws = wb.addWorksheet('Resumen', {
            properties: { tabColor: { argb: argb(C.teal) } },
            views: [{ showGridLines: false }],
            // Vertical y en una sola página, para que las gráficas no se partan al imprimir
            pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
        });
        ws.columns = [{ width: 2 }].concat(Array.from({ length: 12 }, () => ({ width: 12 }))).concat([{ width: 2 }]);
        const B = 2, M = 13; // columnas B..M

        // Banner
        ws.getRow(1).height = 44; ws.getRow(2).height = 22;
        const bannerFill = relleno(C.tealDark);
        combinar(ws, 1, B, M, 'KINETIQ SPORT', { fill: bannerFill, font: fuente({ size: 24, bold: true, color: C.white }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });
        const generado = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
        combinar(ws, 2, B, M, `Resumen de valoraciones · generado el ${generado}`, { fill: bannerFill, font: fuente({ size: 11, color: 'CFEFF5' }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });

        // Filtros aplicados
        const textoFiltros = (opts.filtros && opts.filtros.length) ? `Filtros aplicados: ${opts.filtros.join(' · ')}` : 'Filtros aplicados: ninguno (todas las valoraciones)';
        ws.getRow(3).height = textoFiltros.length > 110 ? 34 : 22;
        combinar(ws, 3, B, M, textoFiltros, { font: fuente({ size: 10, italic: true, color: C.muted }), alignment: { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 } });
        ws.getRow(4).height = 8;

        // Tarjetas de KPI
        const tarjetas = [
            { col: 2, etiqueta: 'VALORACIONES', valor: r.total, fmt: '#,##0', sub: `${r.fisio} fisio · ${r.pelvicos} piso pélvico`, color: C.teal },
            { col: 5, etiqueta: 'PACIENTES ÚNICOS', valor: r.pacientes, fmt: '#,##0', sub: `${r.mujeres} mujeres · ${r.hombres} hombres`, color: C.purple },
            { col: 8, etiqueta: 'DOLOR PROMEDIO (EVA)', valor: r.eva === null ? '–' : Math.round(r.eva * 10) / 10, fmt: '0.0', sub: r.nEva ? `sobre 10 · ${r.nEva} valoraciones con EVA` : 'Sin registros de EVA', color: C.orange },
            { col: 11, etiqueta: 'EDAD PROMEDIO', valor: r.edad === null ? '–' : Math.round(r.edad), fmt: '0', sub: r.nEdad ? `años · ${r.nEdad} con edad registrada` : 'Sin registros de edad', color: C.magenta }
        ];
        ws.getRow(5).height = 22; ws.getRow(6).height = 42; ws.getRow(7).height = 22;
        tarjetas.forEach(t => {
            const c2 = t.col + 2;
            const lados = { left: borde(C.white, 'thick'), right: borde(C.white, 'thick') };
            combinar(ws, 5, t.col, c2, t.etiqueta, { fill: relleno(C.card), font: fuente({ size: 9, bold: true, color: C.muted }), alignment: { vertical: 'bottom', horizontal: 'left', indent: 1 }, border: Object.assign({ top: borde(t.color, 'thick') }, lados) });
            combinar(ws, 6, t.col, c2, t.valor, { fill: relleno(C.card), font: fuente({ size: 28, bold: true, color: t.color }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 }, border: lados }, t.fmt);
            combinar(ws, 7, t.col, c2, t.sub, { fill: relleno(C.card), font: fuente({ size: 9, color: C.muted }), alignment: { vertical: 'top', horizontal: 'left', indent: 1 }, border: Object.assign({ bottom: borde(C.grid) }, lados) });
        });
        ws.getRow(8).height = 12;

        // Secciones con gráficas (2 por fila)
        const seccion = (fila, texto) => {
            ws.getRow(fila).height = 24;
            combinar(ws, fila, B, M, texto, { font: fuente({ size: 12, bold: true, color: C.tealDark }), alignment: { vertical: 'middle', horizontal: 'left' }, border: { bottom: borde(C.teal, 'medium') } });
        };
        const anchoImg = 524, altoImg = 272, filasImg = 14;
        let fila = 9;
        const colocar = (clave, colIndice, filaInicio) => {
            if (!imgs[clave]) return;
            const id = wb.addImage({ base64: imgs[clave], extension: 'png' });
            ws.addImage(id, { tl: { col: colIndice + 0.02, row: filaInicio - 1 + 0.12 }, ext: { width: anchoImg, height: altoImg }, editAs: 'oneCell' });
        };
        const sinDatos = (fila, col1, col2, texto) => combinar(ws, fila, col1, col2, texto, { font: fuente({ size: 10, italic: true, color: C.muted }), alignment: { vertical: 'middle', horizontal: 'center' } });

        seccion(fila, 'Actividad y origen de los pacientes');
        colocar('mes', 1, fila + 1); colocar('origen', 7, fila + 1);
        if (!imgs.mes) sinDatos(fila + 6, B, 7, 'Sin fechas para graficar');
        if (!imgs.origen) sinDatos(fila + 6, 8, M, 'Sin datos de origen');
        fila += 1 + filasImg + 1;

        seccion(fila, 'Equipo y dolor');
        colocar('profesional', 1, fila + 1); colocar('dolor', 7, fila + 1);
        if (!imgs.profesional) sinDatos(fila + 6, B, 7, 'Sin datos de profesionales');
        if (!imgs.dolor) sinDatos(fila + 6, 8, M, 'Sin registros de EVA para graficar');
        fila += 1 + filasImg + 1;

        // Tablas con las cifras
        seccion(fila, 'Detalle en cifras');
        fila += 1;
        const tablas = [
            { col: 2, titulo: 'Por mes', datos: r.meses.map(m => [m.largo, m.n]) },
            { col: 5, titulo: 'Por profesional', datos: r.profesionales },
            { col: 8, titulo: 'Por origen', datos: r.origenes },
            { col: 11, titulo: 'Por módulo', datos: [[MODULO.pisada.largo, r.fisio], [MODULO.piso_pelvico.largo, r.pelvicos]].filter(([, n]) => n > 0) }
        ];
        let maxFilas = 0;
        tablas.forEach(t => {
            const filaEnc = fila;
            const encabezado = { fill: relleno(C.teal), font: fuente({ bold: true, color: C.white }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } };
            combinar(ws, filaEnc, t.col, t.col + 1, t.titulo, encabezado);
            combinar(ws, filaEnc, t.col + 2, t.col + 2, 'Total', Object.assign({}, encabezado, { alignment: { vertical: 'middle', horizontal: 'center' } }));
            ws.getRow(filaEnc).height = 22;
            t.datos.forEach(([etiqueta, n], i) => {
                const f = filaEnc + 1 + i;
                const base = { fill: i % 2 ? relleno(C.zebra) : relleno(C.white), border: { bottom: borde(C.grid) } };
                combinar(ws, f, t.col, t.col + 1, etiqueta, Object.assign({}, base, { font: fuente({}), alignment: { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true } }));
                combinar(ws, f, t.col + 2, t.col + 2, n, Object.assign({}, base, { font: fuente({ bold: true }), alignment: { vertical: 'middle', horizontal: 'center' } }), '#,##0');
                ws.getRow(f).height = Math.max(ws.getRow(f).height || 0, 20);
            });
            if (!t.datos.length) combinar(ws, filaEnc + 1, t.col, t.col + 2, 'Sin datos', { font: fuente({ italic: true, color: C.muted }), alignment: { horizontal: 'center' } });
            maxFilas = Math.max(maxFilas, t.datos.length || 1);
        });
        fila += maxFilas + 2;
        combinar(ws, fila, B, M, 'Generado por Kinetiq Sport · Documento con información clínica confidencial', { font: fuente({ size: 9, italic: true, color: C.gray }), alignment: { horizontal: 'center' } });
        return ws;
    }

    // ---------- Hoja Pacientes ----------
    function hojaPacientes(wb, filas, r, opts) {
        const columnas = [
            { t: 'Fecha', w: 12, k: 'fecha', al: 'center' },
            { t: 'Módulo', w: 17, k: 'modulo', al: 'center' },
            { t: 'Nombre', w: 18, k: 'nombre' },
            { t: 'Apellido', w: 20, k: 'apellido' },
            { t: 'Cédula', w: 14, k: 'cedula', al: 'center' },
            { t: 'Sexo', w: 11, k: 'sexo', al: 'center' },
            { t: 'Edad', w: 7, k: 'edad', al: 'center' },
            { t: 'Peso (kg)', w: 10, k: 'peso', al: 'center' },
            { t: 'Celular', w: 14, k: 'celular', al: 'center' },
            { t: 'Atendido por', w: 14, k: 'profesional', al: 'center' },
            { t: 'Dolor (EVA)', w: 11, k: 'eva', al: 'center' },
            { t: 'Zona de dolor', w: 28, k: 'zonas', wrap: true },
            { t: 'Deporte / motivo', w: 30, k: 'detalle', wrap: true },
            { t: '¿Cómo nos conoció?', w: 26, k: 'fuenteDetalle', wrap: true },
            { t: 'Referido por', w: 20, k: 'referido', wrap: true }
        ];
        const n = columnas.length, filaEnc = 4, primera = 5, ultima = primera + filas.length - 1;
        const ws = wb.addWorksheet('Pacientes', {
            properties: { tabColor: { argb: argb(C.orange) } },
            views: [{ state: 'frozen', xSplit: 0, ySplit: filaEnc, showGridLines: false }],
            pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${filaEnc}:${filaEnc}`, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
        });
        ws.columns = columnas.map(c => ({ width: c.w }));

        // Banner y subtítulo
        ws.getRow(1).height = 38; ws.getRow(2).height = 24; ws.getRow(3).height = 6;
        const fondo = relleno(C.tealDark);
        combinar(ws, 1, 1, n, 'KINETIQ SPORT · Pacientes y valoraciones', { fill: fondo, font: fuente({ size: 18, bold: true, color: C.white }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });
        const filtros = (opts.filtros && opts.filtros.length) ? opts.filtros.join(' · ') : 'sin filtros';
        combinar(ws, 2, 1, n, `${fmtMiles(r.total)} valoraciones · ${fmtMiles(r.pacientes)} pacientes · Filtros: ${filtros}`, { fill: fondo, font: fuente({ size: 10, color: 'CFEFF5' }), alignment: { vertical: 'middle', horizontal: 'left', indent: 1 } });

        // Encabezados
        ws.getRow(filaEnc).height = 30;
        columnas.forEach((c, i) => {
            const celda = ws.getCell(filaEnc, i + 1);
            celda.value = c.t;
            celda.fill = relleno(C.teal);
            celda.font = fuente({ bold: true, color: C.white, size: 10 });
            celda.alignment = { vertical: 'middle', horizontal: c.al || 'left', wrapText: true, indent: c.al ? 0 : 1 };
            celda.border = { bottom: borde(C.tealDark, 'medium'), left: borde('3AAEC4'), right: borde('3AAEC4') };
        });

        // Filas
        filas.forEach((f, idx) => {
            const fila = primera + idx;
            const row = ws.getRow(fila);
            const zebra = idx % 2 ? relleno(C.zebra) : relleno(C.white);
            const fecha = f.fecha instanceof Date && !isNaN(f.fecha) ? new Date(Date.UTC(f.fecha.getFullYear(), f.fecha.getMonth(), f.fecha.getDate())) : null;
            const mod = MODULO[f.modulo] || MODULO.pisada;
            const limpiar = v => String(v ?? '').replace(/\s+/g, ' ').trim();
            const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
            const valores = {
                fecha, modulo: mod.nombre, nombre: limpiar(f.nombre), apellido: limpiar(f.apellido),
                cedula: limpiar(f.cedula), sexo: limpiar(f.sexo), edad: num(f.edad), peso: num(f.peso),
                celular: limpiar(f.celular), profesional: limpiar(f.profesional), eva: num(f.eva),
                zonas: limpiar(f.zonas), detalle: limpiar(f.detalle), fuenteDetalle: limpiar(f.fuenteDetalle), referido: limpiar(f.referido)
            };
            columnas.forEach((c, i) => {
                const celda = row.getCell(i + 1);
                const v = valores[c.k];
                celda.value = v === '' ? null : v;
                celda.fill = zebra;
                celda.font = fuente({});
                celda.alignment = { vertical: 'middle', horizontal: c.al || 'left', wrapText: !!c.wrap, indent: c.al ? 0 : 1 };
                celda.border = { bottom: borde(C.grid), left: borde(C.grid), right: borde(C.grid) };
                if (c.k === 'fecha') celda.numFmt = 'dd/mm/yyyy';
                if (c.k === 'cedula' || c.k === 'celular') celda.numFmt = '@';
                if (c.k === 'peso') celda.numFmt = '0.0';
            });
            // Módulo como etiqueta de color
            const cMod = row.getCell(2);
            cMod.fill = relleno(mod.fondo);
            cMod.font = fuente({ bold: true, color: mod.texto });
            // Profesional con su color
            const cProf = row.getCell(10);
            cProf.font = fuente({ bold: true, color: COLOR_PROFESIONAL[valores.profesional] || C.ink });
            // Dolor en negrita (el color lo pone el formato condicional)
            row.getCell(11).font = fuente({ bold: true, size: 11 });
            row.getCell(3).font = fuente({ bold: true });
        });

        if (filas.length) {
            ws.autoFilter = { from: { row: filaEnc, column: 1 }, to: { row: ultima, column: n } };
            // Escala de color del dolor: verde (1) → amarillo (5) → rojo (10)
            ws.addConditionalFormatting({
                ref: `K${primera}:K${ultima}`,
                rules: [{ type: 'colorScale', cfvo: [{ type: 'num', value: 1 }, { type: 'num', value: 5 }, { type: 'num', value: 10 }], color: [{ argb: 'FF8ED6A8' }, { argb: 'FFFBE08A' }, { argb: 'FFF28B82' }] }]
            });
        }
        return ws;
    }

    // ---------- Punto de entrada ----------
    async function exportar(opts) {
        opts = opts || {};
        const filas = (opts.filas || []).slice();
        if (!filas.length) throw new Error('No hay valoraciones para exportar con los filtros actuales.');

        await Promise.all([
            cargarScript(EXCELJS, () => !!window.ExcelJS),
            cargarScript(CHARTJS, () => !!window.Chart)
        ]);

        const resumen = resumir(filas);
        const imagenes = graficas(resumen);

        const wb = new window.ExcelJS.Workbook();
        wb.creator = 'Kinetiq Sport';
        wb.created = new Date();
        wb.title = 'Valoraciones Kinetiq Sport';
        hojaResumen(wb, filas, resumen, imagenes, opts);
        hojaPacientes(wb, filas, resumen, opts);

        const buffer = await wb.xlsx.writeBuffer();
        const hoy = new Date().toISOString().slice(0, 10);
        const nombre = `${opts.nombre || 'Kinetiq_valoraciones'}_${hoy}.xlsx`;
        const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (window.Kinetiq && typeof window.Kinetiq.descargarArchivo === 'function') window.Kinetiq.descargarArchivo(buffer, nombre, mime);
        else {
            const url = URL.createObjectURL(new Blob([buffer], { type: mime }));
            const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        return { nombre, filas: filas.length };
    }

    window.KinetiqExcel = { exportar, _resumir: resumir };
})();
