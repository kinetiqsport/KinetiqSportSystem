# 🏃‍♂️ Kinetiq Sport — Clinical Management & Biomechanical Evaluation System

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/Security-Supabase%20RLS%20%2B%20OAuth2-blue?style=for-the-badge" alt="Security" />
  <img src="https://img.shields.io/badge/License-Proprietary%20%2F%20All%20Rights%20Reserved-red?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Architecture-Cloud%20Native%20SPA-orange?style=for-the-badge" alt="Architecture" />
</p>

---

## 📌 Visión General del Proyecto

**Kinetiq Sport Clinical System** es una plataforma integral de gestión clínica, valoración biomecánica y seguimiento terapéutico diseñada específicamente para clínicas de fisioterapia deportiva y rehabilitación de piso pélvico.

El sistema digitaliza por completo el flujo de trabajo clínico: desde el registro inicial del paciente y la captura estructurada de datos biomecánicos, hasta la generación automatizada de informes médicos vectoriales en PDF de alta fidelidad y la analítica de derivación de pacientes.

---

## 💡 El Problema que Solucionamos

En la práctica clínica de la fisioterapia y la medicina deportiva tradicional, existen tres grandes fricciones:

1. **Documentación fragmentada y manual:** Gran parte de las evaluaciones (análisis de pisada, goniometría, escalas de dolor, antecedentes ginecobstétricos) se registran en formatos físicos o procesadores de texto genéricos, lo que dificulta la trazabilidad y la continuidad de los tratamientos.
2. **Generación lenta de reportes para pacientes:** Construir un informe para entregar al paciente o al médico remitente tomaba entre 20 y 45 minutos por consulta, con formatos visuales poco estandarizados.
3. **Brechas de seguridad y privacidad médica:** La dispersión de historias clínicas en archivos no cifrados o discos locales compromete la confidencialidad de datos sensibles de salud (normativa de Habeas Data y secreto profesional).

### 🚀 Nuestra Solución
Una aplicación web segura, intuitiva y de alto rendimiento que:
* Estandariza la recolección clínica mediante formularios dinámicos estructurados.
* Genera **reportes médicos en PDF en menos de 2 segundos** con diseño institucional milimétricamente calibrado.
* Proporciona un **dashboard de búsqueda y visualización clínica en tiempo real** con adaptación automática a cualquier tamaño de pantalla.
* Protege la información médica mediante autenticación OAuth 2.0, políticas **Row Level Security (RLS)** en base de datos PostgreSQL y auditoría de modificaciones.

---

## 🩺 Módulos Principales

### 1. Fisioterapia Deportiva & Biomecánica
* **Ficha del Paciente:** Antecedentes deportivos, disciplinas practicadas, frecuencia e intensidad.
* **Evaluación Ortopédica y del Dolor:** Mapeo anatómico de dolencias, escalas análogas del dolor (EVA), mecanismos de lesión.
* **Análisis de la Marcha y Biomecánica:** Registro de patrones de pisada, tipo de calzado, apoyos plantares y recomendaciones de readaptación funcional.
* **Plan de Tratamiento:** Objetivos a corto/mediano plazo, prescripción de ejercicio terapéutico y dosificación.

### 2. Módulo de Piso Pélvico
* **Salud Ginecoobstétrica y Urológica:** Historial de partos, cesáreas, dinámica menstrual, síntomas genitourinarios e incontinencia.
* **Evaluación Perineal:** Tono muscular, reflejos, dinamometría y funcionalidad del suelo pélvico.
* **Dinámica Sexual y Factores Asociados:** Registro seguro y confidencial de sintomatología clínica.
* **Plan Terapéutico Especializado:** Biofeedback, terapia manual y reeducación abdominopélvica.

### 3. Motor Clínico de Reportes en PDF
* Generación 100% en el cliente (client-side) mediante **pdfmake**.
* Cuadrículas estandarizadas de precisión milimétrica (márgenes uniformes, tablas balanceadas).
* Nomenclatura automática y limpia del archivo (`Nombre_Apellido_Fisioterapia_Deportiva.pdf`).
* Inclusión de firmas institucionales, datos de contacto y recomendaciones personalizadas.

### 4. Dashboard de Consulta y Auditoría
* **Búsqueda Instantánea:** Filtrado por cédula, nombre o apellido con indexación rápida.
* **Diseño Responsivo Inteligente:** Cálculo dinámico de tarjetas por página según el alto disponible de la pantalla, eliminando desplazamientos indeseados.
* **Trazabilidad Clínica:** Registro auditable de terapeuta asignado (`atendido_por`), autor de última edición (`modificado_por`) y fecha/hora exacta.

---

## 🔒 Arquitectura de Seguridad y Privacidad de Datos

La aplicación maneja información de salud sensible, por lo que incorpora defensas de grado de producción:

* **Autenticación Criptográfica:** Integración con **Google Identity Services (GIS OAuth 2.0)** validada por tokens JWT en **Supabase Auth**.
* **Base de Datos Blindada (Row Level Security):** Políticas RLS estrictas en PostgreSQL que impiden el acceso anónimo y restringen la lectura/escritura únicamente al personal autorizado en `allowed_users`.
* **Guardia de Sesión Centralizada (`auth-guard.js`):** Validación continua del estado de la sesión, temporizador automático de inactividad a los 45 minutos y purga de memoria local al cerrar sesión.
* **Mitigación de XSS y Clickjacking:** Sanitización rigurosa del DOM y cabeceras HTTP de seguridad (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+ modular), HTML5 Semántico, CSS3 (CSS Grid & Flexbox) |
| **Backend & Base de Datos** | [Supabase](https://supabase.com/) (PostgreSQL 15+, Row-Level Security, Auth JWT, Realtime) |
| **Autenticación** | Google OAuth 2.0 (Google Identity Services) + Supabase Auth |
| **Generación de Documentos** | [pdfmake](https://pdfmake.github.io/docs/) (Renderizado vectorial cliente) |
| **Despliegue & Hosting** | [Vercel](https://vercel.com/) (Edge Network, Serverless rewrite configs) |

---

## 👤 Autor y Desarrollador

Diseñado, desarrollado y arquitecturado por:

**Esteban**  
* **GitHub:** [@esteban0903](https://github.com/esteban0903)  
* **LinkedIn:** [Perfil en LinkedIn](https://www.linkedin.com/in/esteban-alvarez-casta%C3%B1o-129b432a6/)

> *Este proyecto fue desarrollado de forma personalizada para Kinetiq Sport como una solución integral de transformación digital en salud y fisioterapia deportiva.*

---

## 📄 Propiedad Intelectual y Licencia

**Copyright © 2026 Esteban ([@esteban0903](https://github.com/esteban0903)). Todos los derechos reservados.**

Este código y sus activos asociados son de carácter **privado y propietario**. Queda expresamente prohibida la copia no autorizada, distribución, modificación, sublicenciamiento, ingeniería inversa o uso comercial de este software, en su totalidad o en parte, sin la autorización previa y por escrito del autor titular de los derechos de autor. Consulte el archivo [LICENSE](LICENSE) para más información.
