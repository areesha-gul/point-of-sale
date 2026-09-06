const { initPostgres, closePostgres } = require('./postgres');

initPostgres()
    .then(() => closePostgres())
    .catch((error) => {
        console.error('PostgreSQL initialization failed:', error);
        process.exitCode = 1;
    });