const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const backupService = require('../utils/backup');
const { requireMasterAdmin } = require('../middleware/auth');

// List backups
router.get('/', requireMasterAdmin, async (req, res) => {
    try {
        const backups = await backupService.getBackups();
        res.render('backups/list', {
            title: 'Backup Management',
            backups,
            user: req.user
        });
    } catch (error) {
        req.flash('error', 'Error loading backups');
        res.redirect('/');
    }
});

// Create manual backup
router.post('/create', requireMasterAdmin, async (req, res) => {
    try {
        const result = await backupService.createBackup();
        req.flash('success', `Backup created: ${result.fileName}`);
    } catch (error) {
        console.error('Manual backup error:', error);
        req.flash('error', 'Error creating backup: ' + error.message);
    }
    res.redirect('/backups');
});

// Download backup
router.get('/download/:name', requireMasterAdmin, async (req, res) => {
    try {
        const backupPath = path.join(__dirname, '..', 'public', 'backups', req.params.name);

        if (!fs.existsSync(backupPath)) {
            req.flash('error', 'Backup file not found');
            return res.redirect('/backups');
        }

        res.download(backupPath);
    } catch (error) {
        req.flash('error', 'Error downloading backup');
        res.redirect('/backups');
    }
});

// Restore backup
router.post('/restore', requireMasterAdmin, async (req, res) => {
    try {
        const { backup_name } = req.body;
        const backupPath = path.join(__dirname, '..', 'public', 'backups', backup_name);

        if (!fs.existsSync(backupPath)) {
            req.flash('error', 'Backup file not found');
            return res.redirect('/backups');
        }

        await backupService.restoreBackup(backupPath);
        req.flash('success', 'Backup restored successfully! Please restart the application.');

    } catch (error) {
        console.error('Restore error:', error);
        req.flash('error', 'Error restoring backup: ' + error.message);
    }
    res.redirect('/backups');
});

// Delete backup
router.delete('/delete/:name', requireMasterAdmin, async (req, res) => {
    try {
        const backupPath = path.join(__dirname, '..', 'public', 'backups', req.params.name);

        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }

        req.flash('success', 'Backup deleted successfully');
    } catch (error) {
        req.flash('error', 'Error deleting backup');
    }
    res.redirect('/backups');
});

module.exports = router;
