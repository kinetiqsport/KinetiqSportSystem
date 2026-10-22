/**
 * Kinetiq Sport — Clinical Management & Biomechanical Evaluation System
 * Copyright (c) 2026 Esteban (@esteban0903). All rights reserved.
 * Proprietary and confidential. Unauthorized copying or distribution is strictly prohibited.
 */

// kinetiq-common.js - Configuración y utilidades compartidas por formularios y dashboard

(function() {
    // Profesionales por módulo (única fuente de verdad para formularios y estadísticas)
    const PROFESIONALES = {
        pisada: ['Jorge', 'Santiago', 'Mariana'],
        piso_pelvico: ['Nataly']
    };

    // Límites de archivos
    const MAX_ADJUNTO_MB = 10; // Cada adjunto se guarda en la base de datos
    const MAX_CARGA_MB = 15;   // Reporte PDF/JSON cargado (puede incluir adjuntos unidos)

    function todosLosProfesionales() {
        return [...new Set(Object.values(PROFESIONALES).flat())];
    }

    function escapeHtml(val) {
        return String(val ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Quita caracteres reservados de los filtros PostgREST (.or / .ilike) para que el texto
    // buscado no pueda alterar la consulta
    function sanitizeSearch(query) {
        return String(query ?? '').replace(/[,()"'\\*%:.]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Convierte valores antiguos como "5 días" al número que espera el select 0-7
    function normalizarDias(valor) {
        if (valor === null || valor === undefined || valor === '') return '';
        const n = parseInt(String(valor).replace(/\D/g, ''), 10);
        return Number.isFinite(n) && n >= 0 && n <= 7 ? String(n) : '';
    }

    function descargarArchivo(contenido, filename, mime) {
        const blob = new Blob([contenido], { type: mime });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // Respaldo local para el profesional cuando falla la base de datos (se recarga con "Cargar")
    function descargarRespaldoJSON(data, nombreBase) {
        const limpio = String(nombreBase || 'Reporte').replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, '').trim() || 'Reporte';
        descargarArchivo(JSON.stringify(data, null, 2), `Respaldo_${limpio}_${Date.now()}.json`, 'application/json');
    }

    // Llena los <select data-profesionales="modulo"> conservando la opción vacía inicial
    function poblarProfesionales() {
        document.querySelectorAll('select[data-profesionales]').forEach(select => {
            const lista = PROFESIONALES[select.dataset.profesionales] || [];
            const actual = select.value;
            select.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
            lista.forEach(nombre => {
                const option = document.createElement('option');
                option.value = nombre;
                option.textContent = nombre;
                select.appendChild(option);
            });
            if (lista.includes(actual)) select.value = actual;
            else if (!select.querySelector('option[value=""]') && lista.length) select.value = lista[0];
        });
    }

    // Llena los <select data-dias> con las opciones 0 a 7
    function poblarSelectsDias() {
        document.querySelectorAll('select[data-dias]').forEach(select => {
            if (select.options.length > 1) return;
            for (let i = 0; i <= 7; i++) {
                const option = document.createElement('option');
                option.value = String(i);
                option.textContent = i === 1 ? '1 día' : `${i} días`;
                select.appendChild(option);
            }
        });
    }

    // ---------- Índice de secciones con progreso (formularios) ----------
    function camposDeSeccion(section) {
        const grupos = new Map();
        section.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.type === 'file' || el.type === 'hidden' || el.readOnly || el.disabled) return;
            if (el.closest('[data-progreso-ignorar]')) return;
            if (el.type === 'checkbox' && !el.name) return; // Casillas sueltas: "no marcado" también es una respuesta
            const clave = (el.type === 'radio' || el.type === 'checkbox') ? `${el.type}:${el.name}` : `id:${el.id || el.name}`;
            if (!grupos.has(clave)) grupos.set(clave, []);
            grupos.get(clave).push(el);
        });
        let llenos = 0;
        grupos.forEach(els => {
            const lleno = els.some(el => (el.type === 'radio' || el.type === 'checkbox') ? el.checked : String(el.value || '').trim() !== '');
            if (lleno) llenos++;
        });
        return { total: grupos.size, llenos };
    }

    function initProgresoFormulario() {
        const form = document.getElementById('reportForm');
        if (!form || form.querySelector('.form-progress')) return;
        const secciones = [...form.querySelectorAll(':scope > section.section')]
            .filter(s => s.querySelector('.section-header h2') && camposDeSeccion(s).total > 0);
        if (secciones.length < 2) return;

        const nav = document.createElement('nav');
        nav.className = 'form-progress';
        nav.setAttribute('aria-label', 'Secciones del formulario');
        nav.innerHTML = `
            <div class="form-progress-top">
                <span class="form-progress-label">Progreso del formulario</span>
                <span class="form-progress-pct">0%</span>
            </div>
            <div class="form-progress-bar"><span></span></div>
            <div class="form-progress-pills"></div>
        `;
        const pillsCont = nav.querySelector('.form-progress-pills');
        const pills = secciones.map((sec, i) => {
            if (!sec.id) sec.id = `seccion-${i + 1}`;
            const titulo = sec.querySelector('.section-header h2').textContent.trim();
            const corto = titulo.charAt(0) + titulo.slice(1).toLowerCase();
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.className = 'form-progress-pill';
            pill.innerHTML = `<span class="pill-check" aria-hidden="true"></span><span class="pill-text">${escapeHtml(corto)}</span>`;
            pill.addEventListener('click', () => {
                const y = sec.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 12;
                window.scrollTo({ top: y, behavior: 'smooth' });
            });
            pillsCont.appendChild(pill);
            return pill;
        });
        form.insertBefore(nav, form.firstElementChild);

        const actualizar = () => {
            let total = 0, llenos = 0;
            secciones.forEach((sec, i) => {
                const c = camposDeSeccion(sec);
                total += c.total;
                llenos += c.llenos;
                pills[i].classList.toggle('partial', c.llenos > 0 && c.llenos < c.total);
                pills[i].classList.toggle('done', c.total > 0 && c.llenos === c.total);
                pills[i].title = `${c.llenos} de ${c.total} campos completos`;
            });
            const pct = total ? Math.round((llenos / total) * 100) : 0;
            nav.querySelector('.form-progress-pct').textContent = `${pct}%`;
            nav.querySelector('.form-progress-bar span').style.width = `${pct}%`;
        };
        form.addEventListener('input', actualizar);
        form.addEventListener('change', actualizar);
        form.addEventListener('reset', () => setTimeout(actualizar, 0));
        // Los datos cargados por código (paciente, PDF, JSON) no disparan eventos
        setInterval(actualizar, 1500);
        actualizar();

        if ('IntersectionObserver' in window) {
            const obs = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const i = secciones.indexOf(entry.target);
                    pills.forEach((p, j) => p.classList.toggle('active', j === i));
                    pills[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
                });
            }, { rootMargin: '-35% 0px -55% 0px' });
            secciones.forEach(s => obs.observe(s));
        }
    }

    // ---------- Escala de dolor (EVA) como botones 1-10 ----------
    const COLORES_EVA = ['#2E9E5B', '#4CAF50', '#7CB342', '#C0CA33', '#F4B400', '#F59E0B', '#F57C00', '#EF6C00', '#E64A19', '#C62828'];

    function initEscalaDolor() {
        const select = document.getElementById('escalaDolor');
        if (!select || select.dataset.mejorado) return;
        select.dataset.mejorado = '1';

        const cont = document.createElement('div');
        cont.className = 'eva-scale';
        cont.setAttribute('role', 'radiogroup');
        cont.setAttribute('aria-label', 'Escala del dolor de 1 a 10');
        const botones = [];
        for (let i = 1; i <= 10; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'eva-btn';
            b.textContent = i;
            b.style.setProperty('--eva-color', COLORES_EVA[i - 1]);
            b.setAttribute('role', 'radio');
            b.addEventListener('click', () => {
                select.value = select.value === String(i) ? '' : String(i);
                select.dispatchEvent(new Event('change', { bubbles: true }));
                sincronizar();
            });
            botones.push(b);
            cont.appendChild(b);
        }
        const leyenda = document.createElement('div');
        leyenda.className = 'eva-legend';

        const sincronizar = () => {
            const v = parseInt(select.value, 10);
            botones.forEach((b, i) => {
                const activo = v === i + 1;
                b.classList.toggle('selected', activo);
                b.setAttribute('aria-checked', activo ? 'true' : 'false');
            });
            const opt = select.selectedOptions[0];
            leyenda.textContent = v ? (opt ? opt.textContent : String(v)) : 'Sin seleccionar · 1 = muy leve, 10 = máximo';
            leyenda.style.color = v ? COLORES_EVA[v - 1] : '';
        };

        select.classList.add('eva-select-oculto');
        select.setAttribute('tabindex', '-1');
        select.setAttribute('aria-hidden', 'true');
        select.insertAdjacentElement('afterend', cont);
        cont.insertAdjacentElement('afterend', leyenda);
        select.addEventListener('change', sincronizar);
        select.form?.addEventListener('reset', () => setTimeout(sincronizar, 0));
        setInterval(sincronizar, 1500);
        sincronizar();
    }

    // ---------- Estilo de los reportes PDF (jsPDF + AutoTable) ----------
    const TEMAS_PDF = {
        pisada: {
            acento: [10, 148, 176], acentoClaro: [127, 227, 242], acentoSuave: [230, 246, 250],
            oscuro: [11, 20, 23], oscuro2: [15, 42, 49]
        },
        piso_pelvico: {
            acento: [142, 36, 170], acentoClaro: [240, 196, 247], acentoSuave: [245, 233, 248],
            oscuro: [20, 11, 23], oscuro2: [42, 15, 49]
        }
    };
    const PDF_BASE = {
        tinta: [15, 26, 31], tintaSuave: [91, 107, 115], tintaTenue: [138, 152, 159],
        linea: [227, 233, 236], etiqueta: [246, 248, 249]
    };

    const pdf = {
        tema(modulo) {
            return { ...PDF_BASE, ...(TEMAS_PDF[modulo] || TEMAS_PDF.pisada) };
        },

        // Prepara el documento: guarda el tema y aplica el estilo a todas las tablas
        preparar(doc, modulo) {
            const tema = pdf.tema(modulo);
            doc.__tema = tema;
            doc.__seccion = 0;
            const autoTableOriginal = doc.autoTable.bind(doc);
            doc.autoTable = (opts) => autoTableOriginal(pdf.estiloTabla(tema, opts));
            return tema;
        },

        estiloTabla(tema, opts) {
            const columnStyles = {};
            Object.entries(opts.columnStyles || {}).forEach(([k, st]) => {
                const esEtiqueta = st.fontStyle === 'bold';
                columnStyles[k] = {
                    ...st,
                    fillColor: esEtiqueta ? tema.etiqueta : [255, 255, 255],
                    textColor: esEtiqueta ? tema.tintaSuave : tema.tinta
                };
                if (esEtiqueta) columnStyles[k].fontSize = 8;
            });
            // Todas las tablas al ancho completo de la página (186 mm entre márgenes)
            const anchos = Object.values(columnStyles).map(c => c.cellWidth);
            if (anchos.length && anchos.every(w => typeof w === 'number')) {
                const total = anchos.reduce((a, b) => a + b, 0);
                if (total > 0 && Math.abs(total - 186) > 0.5) {
                    Object.values(columnStyles).forEach(c => { c.cellWidth = c.cellWidth * 186 / total; });
                }
            }
            const base = opts.styles || {};
            return {
                ...opts,
                theme: 'grid',
                styles: {
                    ...base,
                    font: 'helvetica',
                    fontSize: Math.min(base.fontSize || 9, 9),
                    textColor: tema.tinta,
                    lineColor: tema.linea,
                    lineWidth: 0.25,
                    cellPadding: { top: 3.4, bottom: 3.4, left: 3.6, right: 3.6 }
                },
                headStyles: undefined,
                alternateRowStyles: {},
                columnStyles
            };
        },

        // Encabezado oscuro de la primera página. Devuelve la Y donde empieza el contenido.
        encabezado(doc, { etiqueta, titulo, paciente, cedula }) {
            const t = doc.__tema;
            doc.setFillColor(...t.oscuro);
            doc.rect(0, 0, 210, 40, 'F');
            // Brillos de color (como en la app)
            try {
                doc.setGState(new doc.GState({ opacity: 0.22 }));
                doc.setFillColor(...t.acento);
                doc.circle(18, 2, 34, 'F');
                doc.setGState(new doc.GState({ opacity: 0.12 }));
                doc.setFillColor(...t.acentoClaro);
                doc.circle(200, 6, 24, 'F'); // dentro de la franja oscura (0-40 mm)
                doc.setGState(new doc.GState({ opacity: 1 }));
            } catch (e) {}
            doc.setFillColor(...t.acento);
            doc.rect(0, 39, 210, 1.2, 'F');

            doc.setFillColor(255, 255, 255);
            doc.roundedRect(12, 8, 24, 24, 3.5, 3.5, 'F');
            try {
                doc.addImage('kinetiq_logo.png', 'PNG', 13.5, 9.5, 21, 21);
            } catch (e) {
                doc.setTextColor(...t.acento);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('KS', 24, 22.5, { align: 'center' });
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...t.acentoClaro);
            doc.text(etiqueta.toUpperCase(), 42, 16.5);
            doc.setFontSize(17);
            doc.setTextColor(255, 255, 255);
            doc.text(titulo, 42, 25);

            const fecha = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(160, 175, 182);
            doc.text('PACIENTE', 198, 14, { align: 'right' });
            doc.setFontSize(10.5);
            doc.setTextColor(255, 255, 255);
            doc.text(doc.splitTextToSize(paciente || 'Paciente', 70)[0], 198, 20.5, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(190, 202, 207);
            doc.text([cedula ? `CC ${cedula}` : '', fecha].filter(Boolean).join('  ·  '), 198, 26.5, { align: 'right' });
            return 52;
        },

        // Título de sección con número en insignia, como las tarjetas de los formularios
        seccion(doc, titulo, y) {
            const t = doc.__tema;
            doc.__seccion = (doc.__seccion || 0) + 1;
            const numero = String(doc.__seccion).padStart(2, '0');
            doc.setFillColor(...t.acentoSuave);
            doc.roundedRect(12, y, 8.5, 8, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(...t.acento);
            doc.text(numero, 16.25, y + 5.5, { align: 'center' });

            const texto = titulo.charAt(0) + titulo.slice(1).toLowerCase();
            doc.setFontSize(11);
            doc.setTextColor(...t.tinta);
            doc.text(texto, 24, y + 5.7);
            const fin = 24 + doc.getTextWidth(texto) + 4;
            doc.setDrawColor(...t.linea);
            doc.setLineWidth(0.3);
            if (fin < 198) doc.line(fin, y + 4, 198, y + 4);
        },

        // Encabezado de página de anexo (imágenes adjuntas)
        anexo(doc, nombre) {
            const t = doc.__tema;
            doc.__paginasAnexo = doc.__paginasAnexo || new Set();
            doc.__paginasAnexo.add(doc.getNumberOfPages());
            doc.setFillColor(...t.oscuro);
            doc.rect(0, 0, 210, 24, 'F');
            doc.setFillColor(...t.acento);
            doc.rect(0, 23, 210, 1, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...t.acentoClaro);
            doc.text('ANEXO ADJUNTO', 14, 11);
            doc.setFontSize(11);
            doc.setTextColor(255, 255, 255);
            doc.text(doc.splitTextToSize(nombre || 'Archivo adjunto', 180)[0], 14, 17.5);
        },

        // Pie en todas las páginas y encabezado mínimo a partir de la segunda
        pie(doc, subtitulo, paciente) {
            const t = doc.__tema;
            const total = doc.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                if (i > 1 && !doc.__paginasAnexo?.has(i)) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7.5);
                    doc.setTextColor(...t.acento);
                    doc.text('KINETIQ SPORTS', 12, 10);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(...t.tintaTenue);
                    doc.text(paciente || '', 198, 10, { align: 'right' });
                    doc.setDrawColor(...t.linea);
                    doc.setLineWidth(0.3);
                    doc.line(12, 12.5, 198, 12.5);
                }
                doc.setDrawColor(...t.linea);
                doc.setLineWidth(0.3);
                doc.line(12, 281, 198, 281);
                doc.setFillColor(...t.acento);
                doc.roundedRect(12, 284.2, 2.2, 2.2, 0.6, 0.6, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                doc.setTextColor(...t.tinta);
                doc.text('Kinetiq Sports', 16, 286);
                const ancho = doc.getTextWidth('Kinetiq Sports');
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...t.tintaTenue);
                doc.text(`·  ${subtitulo}  ·  Información clínica confidencial`, 16 + ancho + 1.5, 286);
                doc.text(`Página ${i} de ${total}`, 198, 286, { align: 'right' });
            }
        }
    };

    window.Kinetiq = {
        PROFESIONALES,
        MAX_ADJUNTO_MB,
        MAX_CARGA_MB,
        todosLosProfesionales,
        escapeHtml,
        sanitizeSearch,
        normalizarDias,
        descargarArchivo,
        descargarRespaldoJSON,
        pdf
    };

    function initUI() {
        poblarProfesionales();
        poblarSelectsDias();
        initEscalaDolor();
        initProgresoFormulario();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
})();
