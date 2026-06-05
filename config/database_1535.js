import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for cloud databases like Neon
    }
});

// A quick test to confirm the cloud connection works when the server starts
pool.on('connect', () => {
    console.log("✅ Successfully connected to Neon Cloud Database!");
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

export default pool;