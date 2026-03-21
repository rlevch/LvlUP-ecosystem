#!/usr/bin/env node
// =============================================================================
// SCORE Coaching — Генератор ключей для Supabase
// =============================================================================
// Запуск: node infrastructure/scripts/generate-keys.js
// Генерирует JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
// =============================================================================

const crypto = require('crypto');

// Генерация JWT Secret
const jwtSecret = crypto.randomBytes(64).toString('base64');

// Простая генерация JWT (без зависимостей)
function createJWT(payload, secret) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
}

// Anon key payload
const anonPayload = {
    role: 'anon',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60), // 10 лет
};

// Service role key payload
const servicePayload = {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60),
};

const anonKey = createJWT(anonPayload, jwtSecret);
const serviceKey = createJWT(servicePayload, jwtSecret);

console.log('='.repeat(60));
console.log('SCORE Coaching — Generated Keys');
console.log('='.repeat(60));
console.log('');
console.log('# Скопируй эти значения в .env:');
console.log('');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log('');
console.log(`ANON_KEY=${anonKey}`);
console.log('');
console.log(`SERVICE_ROLE_KEY=${serviceKey}`);
console.log('');
console.log(`REALTIME_ENC_KEY=${crypto.randomBytes(48).toString('base64')}`);
console.log('');
console.log(`REALTIME_SECRET_KEY_BASE=${crypto.randomBytes(64).toString('base64')}`);
console.log('');
console.log(`POSTGRES_PASSWORD=${crypto.randomBytes(24).toString('base64url')}`);
console.log('');
console.log(`MINIO_ROOT_PASSWORD=${crypto.randomBytes(24).toString('base64url')}`);
console.log('');
console.log(`REDIS_PASSWORD=${crypto.randomBytes(24).toString('base64url')}`);
console.log('');
console.log(`GRAFANA_PASSWORD=${crypto.randomBytes(16).toString('base64url')}`);
console.log('');
console.log('='.repeat(60));
