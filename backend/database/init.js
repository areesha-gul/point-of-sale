const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'pos.db');
const schemaPath = path.join(__dirname, 'schema.sql');

async function initializeDatabase() {
    try {
        console.log('Initializing SQL.js...');
        const SQL = await initSqlJs();
        
        // Read schema SQL
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Create new database
        console.log('Creating new database...');
        const db = new SQL.Database();
        
        console.log('Creating database tables...');
        
        // Execute schema
        db.exec(schema);
        
        console.log('Database tables created successfully.');
        
        // Seed initial data
        console.log('Seeding initial data...');
        
        // Create default cash and bank accounts with formatted IDs
        const insertAccount = db.prepare(`
            INSERT OR IGNORE INTO cash_bank_accounts (account_id, name, type, opening_balance, current_balance) 
            VALUES (?, ?, ?, ?, ?)
        `);
        insertAccount.run(['ACC-00001', 'Cash in Hand', 'cash', 0, 0]);
        insertAccount.run(['ACC-00002', 'Main Bank Account', 'bank', 0, 0]);
        insertAccount.free();
        
        console.log('Default accounts created.');
        
        // Create default admin user
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)');
        try {
            insertUser.run(['admin', hashedPassword, 'owner']);
            console.log('Default admin user created (username: admin, password: admin123)');
        } catch (err) {
            console.log('Admin user already exists');
        }
        insertUser.free();
        
        console.log('Initial data seeded successfully.');
        
        // Save database to file
        console.log('Saving database to file...');
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
        
        db.close();
        
        console.log('Database initialization complete!');
        console.log(`Database file created at: ${dbPath}`);
        console.log('\nYou can now start the server with: npm run dev');
        console.log('Login with: username=admin, password=admin123');
        
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

initializeDatabase();
