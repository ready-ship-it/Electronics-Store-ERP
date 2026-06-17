const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const decompress = require('decompress');
const { Client } = require('basic-ftp');
const { exec } = require('child_process');
const util = require('util');
const db = require('./database');

const execPromise = util.promisify(exec);

// FIXED: Store backups OUTSIDE public directory
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'products');

class BackupService {
    constructor() {
        this.ensureBackupDir();
    }

    async ensureBackupDir() {
        try {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        } catch (error) {
            console.error('Backup directory error:', error);
        }
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup_${timestamp}`;
        const backupPath = path.join(BACKUP_DIR, `${backupName}.zip`);

        try {
            // FIXED: Use mysqldump CLI instead of manual SQL generation
            const dumpFile = path.join(BACKUP_DIR, `${backupName}.sql`);
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'electronics_store'
            };

            const dumpCommand = `mysqldump -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.password ? `-p'${dbConfig.password}'` : ''} ${dbConfig.database} > "${dumpFile}"`;

            try {
                await execPromise(dumpCommand);
            } catch (dumpError) {
                console.warn('mysqldump not available, falling back to manual dump:', dumpError.message);
                await this.manualSqlDump(dumpFile);
            }

            // Create ZIP archive
            const output = require('fs').createWriteStream(backupPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            await new Promise((resolve, reject) => {
                output.on('close', resolve);
                archive.on('error', reject);
                archive.on('warning', (err) => {
                    if (err.code === 'ENOENT') console.warn('Archive warning:', err);
                    else reject(err);
                });

                archive.pipe(output);
                archive.file(dumpFile, { name: `${backupName}.sql` });

                // Add product images if they exist
                try {
                    const files = require('fs').readdirSync(UPLOADS_DIR);
                    if (files.length > 0) {
                        archive.directory(UPLOADS_DIR, 'uploads/products');
                    }
                } catch (e) {
                    // Uploads directory might not exist
                }

                archive.finalize();
            });

            // Remove temp SQL file
            await fs.unlink(dumpFile);

            // Upload to FTP if configured
            await this.uploadToFTP(backupPath, `${backupName}.zip`);

            return {
                success: true,
                fileName: `${backupName}.zip`,
                path: backupPath,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Backup creation error:', error);
            throw error;
        }
    }

    // Fallback manual dump (safer than original - uses parameterized queries)
    async manualSqlDump(sqlPath) {
        const tables = ['users', 'categories', 'products', 'sales', 'sale_items', 'stock_logs', 'settings'];
        let sqlDump = `-- Electronics Store ERP Backup\n-- Generated: ${new Date().toISOString()}\n\n`;
        sqlDump += `SET FOREIGN_KEY_CHECKS=0;\n\n`;

        for (const table of tables) {
            try {
                const [rows] = await db.execute(`SELECT * FROM \`${table}\``);
                if (rows.length > 0) {
                    sqlDump += `\n-- Table: ${table}\n`;
                    sqlDump += `TRUNCATE TABLE \`${table}\`;\n`;

                    const columns = Object.keys(rows[0]);
                    const columnNames = columns.map(c => `\`${c}\``).join(', ');

                    for (const row of rows) {
                        const values = columns.map(col => {
                            const val = row[col];
                            if (val === null) return 'NULL';
                            if (typeof val === 'string') return `'${val.replace(/'/g, "\'")}'`;
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "\'")}'`;
                            return val;
                        }).join(', ');

                        sqlDump += `INSERT INTO \`${table}\` (${columnNames}) VALUES (${values});\n`;
                    }
                }
            } catch (error) {
                console.error(`Error backing up table ${table}:`, error.message);
            }
        }

        sqlDump += `\nSET FOREIGN_KEY_CHECKS=1;\n`;
        await fs.writeFile(sqlPath, sqlDump);
    }

    async restoreBackup(backupFile) {
        const extractPath = path.join(BACKUP_DIR, 'temp_restore');

        try {
            // Extract ZIP
            await fs.mkdir(extractPath, { recursive: true });
            await decompress(backupFile, extractPath);

            // Find SQL file
            const files = await fs.readdir(extractPath);
            const sqlFile = files.find(f => f.endsWith('.sql'));

            if (!sqlFile) {
                throw new Error('No SQL file found in backup');
            }

            // FIXED: Use mysql CLI for restore instead of manual statement execution
            const sqlFilePath = path.join(extractPath, sqlFile);
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'electronics_store'
            };

            const restoreCommand = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.password ? `-p'${dbConfig.password}'` : ''} ${dbConfig.database} < "${sqlFilePath}"`;

            try {
                await execPromise(restoreCommand);
            } catch (restoreError) {
                console.warn('mysql CLI restore failed, falling back to manual:', restoreError.message);
                await this.manualRestore(sqlFilePath);
            }

            // Restore images if present
            const uploadsRestorePath = path.join(extractPath, 'uploads', 'products');
            const uploadsTargetPath = path.join(__dirname, '..', 'public', 'uploads', 'products');

            try {
                const imageFiles = await fs.readdir(uploadsRestorePath);
                await fs.mkdir(uploadsTargetPath, { recursive: true });
                for (const img of imageFiles) {
                    await fs.copyFile(
                        path.join(uploadsRestorePath, img),
                        path.join(uploadsTargetPath, img)
                    );
                }
            } catch (e) {
                // No images to restore
            }

            // Cleanup
            await fs.rm(extractPath, { recursive: true, force: true });

            return { success: true, message: 'Backup restored successfully' };

        } catch (error) {
            try {
                await fs.rm(extractPath, { recursive: true, force: true });
            } catch (e) {}
            throw error;
        }
    }

    async manualRestore(sqlFilePath) {
        const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
        // Split by semicolon but be careful with statements inside values
        const statements = sqlContent.split(';').filter(s => s.trim());

        for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('SET')) {
                try {
                    await db.execute(trimmed + ';');
                } catch (error) {
                    console.error('Error executing statement:', error.message);
                }
            }
        }
    }

    async getBackups() {
        try {
            const files = await fs.readdir(BACKUP_DIR);
            const backups = [];

            for (const file of files) {
                if (file.endsWith('.zip')) {
                    const stat = await fs.stat(path.join(BACKUP_DIR, file));
                    backups.push({
                        name: file,
                        size: this.formatBytes(stat.size),
                        created: stat.birthtime,
                        path: path.join(BACKUP_DIR, file)
                    });
                }
            }

            return backups.sort((a, b) => b.created - a.created);
        } catch (error) {
            return [];
        }
    }

    async cleanupOldBackups(keepCount = 5) {
        const backups = await this.getBackups();

        if (backups.length > keepCount) {
            const toDelete = backups.slice(keepCount);

            for (const backup of toDelete) {
                try {
                    await fs.unlink(backup.path);
                    console.log(`🗑️ Deleted old backup: ${backup.name}`);
                } catch (error) {
                    console.error(`Error deleting backup ${backup.name}:`, error);
                }
            }
        }

        return { deleted: Math.max(0, backups.length - keepCount), kept: Math.min(backups.length, keepCount) };
    }

    async uploadToFTP(localPath, remoteName) {
        const ftpHost = process.env.FTP_HOST;
        const ftpUser = process.env.FTP_USER;
        const ftpPass = process.env.FTP_PASSWORD;
        const ftpPath = process.env.FTP_BACKUP_PATH || '/';

        if (!ftpHost || !ftpUser || !ftpPass) {
            return; // FTP not configured
        }

        const client = new Client();
        client.ftp.verbose = false;

        try {
            await client.access({
                host: ftpHost,
                user: ftpUser,
                password: ftpPass,
                secure: true // FIXED: Use FTPS (secure connection)
            });

            await client.ensureDir(ftpPath);
            await client.uploadFrom(localPath, remoteName);
            console.log(`📤 Backup uploaded to FTP: ${remoteName}`);
        } catch (error) {
            console.error('FTP upload error:', error.message);
        } finally {
            client.close();
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new BackupService();
