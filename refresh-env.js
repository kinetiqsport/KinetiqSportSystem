// Lee .env y genera env-config.js
// Ejecutar: node refresh-env.js

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const outputPath = path.join(__dirname, 'env-config.js');

if (!fs.existsSync(envPath)) {
    console.error('❌ No se encontró .env. Cópialo desde .env.example o créalo.');
    process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
                val = val.slice(1, -1);
            }
            env[trimmed.slice(0, eqIdx).trim()] = val;
        }
    }
});

const anonKey = env.SUPABASE_ANON_KEY || '';
const clientId = env.GOOGLE_CLIENT_ID || '';

if (!anonKey) console.warn('⚠️  SUPABASE_ANON_KEY no está en .env');
if (!clientId) console.warn('⚠️  GOOGLE_CLIENT_ID no está en .env');

const content = [
    '// Generado por refresh-env.js - No editar manualmente',
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(anonKey)};`,
    `window.GOOGLE_CLIENT_ID = ${JSON.stringify(clientId)};`,
    ''
].join('\n');

fs.writeFileSync(outputPath, content);
console.log(`✓ env-config.js generado desde .env`);
