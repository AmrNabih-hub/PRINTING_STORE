// Global Vitest setup for web app tests
process.env.DB_DATABASE = 'printing_store_test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-bytes-long';
process.env.ALLOWED_ORIGIN = 'http://localhost:3000';
