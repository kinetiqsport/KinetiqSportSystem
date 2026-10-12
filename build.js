const fs = require('fs');

const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';

const content = `// Generado dinámicamente en build
window.SUPABASE_ANON_KEY = ${JSON.stringify(supabaseKey)};
window.GOOGLE_CLIENT_ID = ${JSON.stringify(googleClientId)};
console.log('✓ env-config loaded');
`;

fs.writeFileSync('env-config.js', content, 'utf8');
console.log('✓ env-config.js generado exitosamente en build');
